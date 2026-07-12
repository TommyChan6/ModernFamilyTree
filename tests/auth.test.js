import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { randomUUID } from 'crypto'
import { channelHandlers, EMPTY_DB, createInitialDB } from '../src/shared/dbCore'
import {
  __setPbkdf2IterationsForTesting,
  hashPassword,
  verifyPassword,
  resolveSession,
  wrapRequest,
  unwrapRequest,
  PLAN_LIMITS,
  PUBLIC_CHANNELS
} from '../src/shared/auth'

// The real iteration count (600k) is deliberately slow; tests don't need the
// work factor, only the mechanics.
beforeAll(() => __setPbkdf2IterationsForTesting(1000))

const NOW = '2026-01-01 00:00:00'
const env = {
  uuid: () => randomUUID(),
  nowStr: () => NOW,
  storeImageFile: (p) => p,
  removeImageFile: () => {}
}

/** Build the AuthCtx a shell would resolve from this token. */
function ctxFor(db, token) {
  return { user: resolveSession(db, token, NOW), token: token ?? null }
}

async function register(db, username, password = 'hunter2hunter2', acceptedTerms = true) {
  return channelHandlers['auth:register'](db, { username, password, acceptedTerms }, env)
}

let db
beforeEach(() => {
  db = createInitialDB(env) // one unowned seeded project, like a pre-auth install
})

// ─────────────────────────────────────────────────────────────────────────────
describe('password hashing', () => {
  it('hashes with PBKDF2 and never stores the plaintext', async () => {
    const rec = await hashPassword('correct horse battery')
    expect(rec.password_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(rec.password_salt).toMatch(/^[0-9a-f]{32}$/)
    expect(rec.password_hash).not.toContain('correct horse battery')
    expect(await verifyPassword('correct horse battery', rec)).toBe(true)
    expect(await verifyPassword('wrong horse', rec)).toBe(false)
  })

  it('salts every hash — same password, different hashes', async () => {
    const a = await hashPassword('same-password')
    const b = await hashPassword('same-password')
    expect(a.password_hash).not.toBe(b.password_hash)
  })
})

describe('auth:register', () => {
  it('creates a user, returns a session token, leaks no credentials', async () => {
    const res = await register(db, 'Alice')
    expect(res.user.username).toBe('Alice')
    expect(res.user.plan).toBe('free')
    expect(res.user.password_hash).toBeUndefined()
    expect(res.user.password_salt).toBeUndefined()
    expect(res.token).toMatch(/^[0-9a-f]{64}$/)
    const stored = Object.values(db.users)[0]
    expect(stored.password_hash).toBeDefined()
    expect(stored.password_hash).not.toBe('hunter2hunter2')
    expect(stored.tos_accepted_at).toBe(NOW)
    expect(resolveSession(db, res.token, NOW)?.id).toBe(res.user.id)
  })

  it('rejects bad usernames, short passwords, and missing terms', async () => {
    await expect(register(db, 'ab')).rejects.toThrow(/at least 3/)
    await expect(register(db, 'has spaces')).rejects.toThrow(/letters, numbers/)
    await expect(register(db, 'alice', 'short')).rejects.toThrow(/at least 8/)
    await expect(register(db, 'alice', 'longenough', false)).rejects.toThrow(/Terms/)
  })

  it('rejects duplicate usernames case-insensitively', async () => {
    await register(db, 'Alice')
    await expect(register(db, 'ALICE')).rejects.toThrow(/already taken/)
  })

  it('first account claims pre-auth projects; later accounts get their own seeded project', async () => {
    const legacyProjectId = db.activeProjectId
    const first = await register(db, 'alice')
    expect(db.projects[legacyProjectId].user_id).toBe(first.user.id)

    const second = await register(db, 'bob')
    const bobProjects = Object.values(db.projects).filter((p) => p.user_id === second.user.id)
    expect(bobProjects).toHaveLength(1)
    expect(bobProjects[0].id).not.toBe(legacyProjectId)
    // Bob's project is seeded and active
    expect(db.activeProjectId).toBe(bobProjects[0].id)
    const bobPersons = Object.values(db.persons).filter((p) => p.project_id === bobProjects[0].id)
    expect(bobPersons.length).toBeGreaterThan(0)
  })
})

describe('auth:login', () => {
  it('signs in with correct credentials and switches to the user’s project', async () => {
    const reg = await register(db, 'alice', 'password123')
    const res = await channelHandlers['auth:login'](
      db,
      { username: 'ALICE', password: 'password123' },
      env
    )
    expect(res.user.id).toBe(reg.user.id)
    expect(res.token).not.toBe(reg.token)
    expect(db.projects[db.activeProjectId].user_id).toBe(reg.user.id)
  })

  it('rejects wrong password and unknown user with the same vague message', async () => {
    await register(db, 'alice', 'password123')
    await expect(
      channelHandlers['auth:login'](db, { username: 'alice', password: 'nope-nope' }, env)
    ).rejects.toThrow('Invalid username or password')
    await expect(
      channelHandlers['auth:login'](db, { username: 'nobody', password: 'password123' }, env)
    ).rejects.toThrow('Invalid username or password')
  })

  it('locks the account after 5 failed attempts', async () => {
    await register(db, 'alice', 'password123')
    for (let i = 0; i < 5; i++) {
      await expect(
        channelHandlers['auth:login'](db, { username: 'alice', password: 'wrong-wrong' }, env)
      ).rejects.toThrow()
    }
    await expect(
      channelHandlers['auth:login'](db, { username: 'alice', password: 'password123' }, env)
    ).rejects.toThrow(/Too many failed attempts/)
  })
})

describe('auth:guest', () => {
  it('starts a passwordless guest session on the guest plan with a project', () => {
    const res = channelHandlers['auth:guest'](db, undefined, env)
    expect(res.user.plan).toBe('guest')
    expect(res.user.username).toBe('Guest')
    expect(res.user.password_hash).toBeUndefined()
    expect(res.token).toMatch(/^[0-9a-f]{64}$/)
    expect(resolveSession(db, res.token, NOW)?.id).toBe(res.user.id)
    // A guest always lands on a project they own.
    expect(db.projects[db.activeProjectId].user_id).toBe(res.user.id)
  })

  it('reuses the single shared guest account across sign-ins', () => {
    const a = channelHandlers['auth:guest'](db, undefined, env)
    const b = channelHandlers['auth:guest'](db, undefined, env)
    expect(b.user.id).toBe(a.user.id)
    expect(b.token).not.toBe(a.token) // fresh session each time
    expect(Object.values(db.users).filter((u) => u.plan === 'guest')).toHaveLength(1)
  })

  it('cannot collide with a registered login (guest key is unregisterable)', async () => {
    channelHandlers['auth:guest'](db, undefined, env)
    // 'guest (visitor)' can never be produced by validateUsername, so a real
    // account named "guest" coexists without ambiguity.
    const reg = await register(db, 'guest', 'password123')
    expect(reg.user.plan).toBe('free')
    expect(Object.values(db.users)).toHaveLength(2)
  })
})

describe('sessions', () => {
  it('auth:session returns the user and usage for a live token', async () => {
    const { token } = await register(db, 'alice')
    const res = channelHandlers['auth:session'](db, undefined, env, ctxFor(db, token))
    expect(res.user.username).toBe('alice')
    expect(res.usage.maxPersons).toBe(PLAN_LIMITS.free.maxPersons)
    expect(res.usage.projects).toBe(1)
  })

  it('expired tokens stop resolving', async () => {
    const { token } = await register(db, 'alice')
    db.sessions[token].expires_at = '2025-12-31 23:59:59'
    expect(resolveSession(db, token, NOW)).toBeNull()
  })

  it('auth:logout revokes the session', async () => {
    const { token } = await register(db, 'alice')
    channelHandlers['auth:logout'](db, undefined, env, ctxFor(db, token))
    expect(resolveSession(db, token, NOW)).toBeNull()
  })
})

describe('auth:updateProfile', () => {
  it('sets display name, bio, and avatar hue; returns no credentials', async () => {
    const { token } = await register(db, 'alice')
    const res = channelHandlers['auth:updateProfile'](
      db,
      { display_name: '  Alice L.  ', bio: 'Family historian', avatar_hue: 205 },
      env,
      ctxFor(db, token)
    )
    expect(res.display_name).toBe('Alice L.')
    expect(res.bio).toBe('Family historian')
    expect(res.avatar_hue).toBe(205)
    expect(res.password_hash).toBeUndefined()
    const stored = Object.values(db.users)[0]
    expect(stored.display_name).toBe('Alice L.')
  })

  it('clears fields with empty strings / null hue, and leaves omitted fields alone', async () => {
    const { token } = await register(db, 'alice')
    const ctx = ctxFor(db, token)
    channelHandlers['auth:updateProfile'](db, { display_name: 'Alice', bio: 'hi' }, env, ctx)
    const res = channelHandlers['auth:updateProfile'](
      db,
      { display_name: '', avatar_hue: null },
      env,
      ctx
    )
    expect(res.display_name).toBeNull()
    expect(res.avatar_hue).toBeNull()
    expect(res.bio).toBe('hi') // untouched — not in the payload
  })

  it('rejects over-long fields, bad hues, and missing sessions', async () => {
    const { token } = await register(db, 'alice')
    const ctx = ctxFor(db, token)
    expect(() =>
      channelHandlers['auth:updateProfile'](db, { display_name: 'x'.repeat(41) }, env, ctx)
    ).toThrow(/at most 40/)
    expect(() =>
      channelHandlers['auth:updateProfile'](db, { bio: 'x'.repeat(281) }, env, ctx)
    ).toThrow(/at most 280/)
    expect(() => channelHandlers['auth:updateProfile'](db, { avatar_hue: 400 }, env, ctx)).toThrow(
      /Invalid avatar/
    )
    expect(() => channelHandlers['auth:updateProfile'](db, { display_name: 'x' }, env)).toThrow(
      /Not signed in/
    )
  })
})

describe('auth:changePassword', () => {
  it('requires the correct current password and a valid new one', async () => {
    const { token } = await register(db, 'alice', 'password123')
    const ctx = ctxFor(db, token)
    await expect(
      channelHandlers['auth:changePassword'](
        db,
        { currentPassword: 'wrong-wrong', newPassword: 'newpassword1' },
        env,
        ctx
      )
    ).rejects.toThrow(/Current password is incorrect/)
    await expect(
      channelHandlers['auth:changePassword'](
        db,
        { currentPassword: 'password123', newPassword: 'short' },
        env,
        ctx
      )
    ).rejects.toThrow(/at least 8/)
  })

  it('re-hashes the password and revokes every other session', async () => {
    const { token, user } = await register(db, 'alice', 'password123')
    // A second signed-in device
    const other = await channelHandlers['auth:login'](
      db,
      { username: 'alice', password: 'password123' },
      env
    )
    await channelHandlers['auth:changePassword'](
      db,
      { currentPassword: 'password123', newPassword: 'brand-new-pass' },
      env,
      ctxFor(db, token)
    )
    const stored = db.users[user.id]
    expect(await verifyPassword('brand-new-pass', stored)).toBe(true)
    expect(await verifyPassword('password123', stored)).toBe(false)
    expect(resolveSession(db, token, NOW)?.id).toBe(user.id) // this device stays
    expect(resolveSession(db, other.token, NOW)).toBeNull() // the other is out
  })
})

describe('projects:overview', () => {
  it('returns only the user’s projects, each with its counts', async () => {
    const alice = await register(db, 'alice')
    const alicePid = db.activeProjectId
    await register(db, 'bob') // bob's seeded project must not leak into alice's view
    const res = channelHandlers['projects:overview'](db, undefined, env, ctxFor(db, alice.token))
    expect(res.projects).toHaveLength(1)
    const p = res.projects[0]
    expect(p.id).toBe(alicePid)
    const seeded = Object.values(db.persons).filter((x) => x.project_id === alicePid).length
    expect(p.counts.persons).toBe(seeded)
    expect(p.counts.relationships).toBeGreaterThan(0)
    expect(p.counts.images).toBe(0)
  })
})

describe('per-user scoping and ownership', () => {
  it('projects:getAll only returns the requesting user’s projects', async () => {
    const alice = await register(db, 'alice')
    const bob = await register(db, 'bob')
    const aliceList = channelHandlers['projects:getAll'](
      db,
      undefined,
      env,
      ctxFor(db, alice.token)
    )
    const bobList = channelHandlers['projects:getAll'](db, undefined, env, ctxFor(db, bob.token))
    expect(aliceList.projects.every((p) => p.user_id === alice.user.id)).toBe(true)
    expect(bobList.projects.every((p) => p.user_id === bob.user.id)).toBe(true)
    expect(aliceList.projects.length).toBe(1)
    expect(bobList.projects.length).toBe(1)
  })

  it('another user’s project cannot be activated, renamed, or deleted', async () => {
    const alice = await register(db, 'alice')
    const aliceProjectId = db.activeProjectId
    const bob = await register(db, 'bob')
    const bobCtx = ctxFor(db, bob.token)
    expect(() =>
      channelHandlers['projects:setActive'](db, { id: aliceProjectId }, env, bobCtx)
    ).toThrow('Project not found')
    expect(() =>
      channelHandlers['projects:rename'](db, { id: aliceProjectId, name: 'mine now' }, env, bobCtx)
    ).toThrow('Project not found')
    expect(() =>
      channelHandlers['projects:delete'](db, { id: aliceProjectId }, env, bobCtx)
    ).toThrow('Project not found')
    expect(db.projects[aliceProjectId].user_id).toBe(alice.user.id)
  })

  it('deleting the active project falls back to another project of the SAME user', async () => {
    const alice = await register(db, 'alice')
    const ctx = ctxFor(db, alice.token)
    const second = channelHandlers['projects:create'](db, { name: 'Second' }, env, ctx)
    channelHandlers['projects:setActive'](db, { id: second.id }, env, ctx)
    channelHandlers['projects:delete'](db, { id: second.id }, env, ctx)
    expect(db.projects[db.activeProjectId].user_id).toBe(alice.user.id)
  })
})

describe('plan limits', () => {
  it('blocks persons:create at the persons cap', async () => {
    const { token } = await register(db, 'alice')
    const ctx = ctxFor(db, token)
    const pid = db.activeProjectId
    for (let i = 0; i < PLAN_LIMITS.free.maxPersons; i++) {
      const id = `filler-${i}`
      db.persons[id] = { id, project_id: pid, name: `P${i}`, created_at: NOW, updated_at: NOW }
    }
    expect(() => channelHandlers['persons:create'](db, { name: 'One Too Many' }, env, ctx)).toThrow(
      /limit reached/
    )
  })

  it('blocks projects:create at the projects cap', async () => {
    const { token, user } = await register(db, 'alice')
    const ctx = ctxFor(db, token)
    for (let i = Object.values(db.projects).length; i < PLAN_LIMITS.free.maxProjects; i++) {
      const id = `proj-${i}`
      db.projects[id] = { id, name: `P${i}`, user_id: user.id, created_at: NOW, updated_at: NOW }
    }
    expect(() => channelHandlers['projects:create'](db, { name: 'Extra' }, env, ctx)).toThrow(
      /limit reached/
    )
  })

  it('blocks images:add at the photos cap', async () => {
    const { token } = await register(db, 'alice')
    const ctx = ctxFor(db, token)
    const pid = db.activeProjectId
    const personId = Object.values(db.persons).find((p) => p.project_id === pid).id
    for (let i = 0; i < PLAN_LIMITS.free.maxImages; i++) {
      const id = `img-${i}`
      db.images[id] = {
        id,
        project_id: pid,
        person_id: personId,
        file_path: `x-${i}.webp`,
        is_primary: false,
        created_at: NOW
      }
    }
    expect(() =>
      channelHandlers['images:add'](db, { personId, srcPath: 'y.webp' }, env, ctx)
    ).toThrow(/limit reached/)
  })

  it('quota checks are skipped without a ctx (legacy/direct calls keep working)', () => {
    const res = channelHandlers['persons:create'](db, { name: 'Free Agent' }, env)
    expect(res.name).toBe('Free Agent')
  })
})

describe('request envelope', () => {
  it('round-trips a token and payload', () => {
    const wrapped = wrapRequest('tok-123', { a: 1 })
    expect(unwrapRequest(wrapped)).toEqual({ token: 'tok-123', data: { a: 1 } })
  })

  it('passes bare payloads through with no token', () => {
    expect(unwrapRequest({ a: 1 })).toEqual({ token: null, data: { a: 1 } })
    expect(unwrapRequest(undefined)).toEqual({ token: null, data: undefined })
  })

  it('data channels are not public; auth and globalSettings are', () => {
    expect(PUBLIC_CHANNELS.has('persons:getAll')).toBe(false)
    expect(PUBLIC_CHANNELS.has('projects:getAll')).toBe(false)
    expect(PUBLIC_CHANNELS.has('auth:login')).toBe(true)
    expect(PUBLIC_CHANNELS.has('auth:guest')).toBe(true)
    expect(PUBLIC_CHANNELS.has('globalSettings:getAll')).toBe(true)
  })
})

describe('EMPTY_DB shape', () => {
  it('includes the users and sessions tables', () => {
    const fresh = EMPTY_DB()
    expect(fresh.users).toEqual({})
    expect(fresh.sessions).toEqual({})
  })
})
