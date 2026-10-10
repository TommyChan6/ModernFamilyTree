<template>
  <div class="bp">
    <div class="bp-plan" :class="'tier-' + plan">
      <div class="bp-plan-main">
        <PlanBadge :plan="plan" big />
        <p class="bp-plan-line">
          <template v-if="sub && sub.status === 'active'">
            {{ money(offer.price[sub.interval]) }} /
            {{ sub.interval === 'year' ? t('billing.yearWord') : t('billing.monthWord') }}
            ·
            <span :class="{ warn: sub.cancel_at_period_end }">
              {{
                sub.cancel_at_period_end
                  ? t('billing.panel.endsOn', { date: fmtDate(sub.current_period_end) })
                  : t('billing.panel.renewsOn', { date: fmtDate(sub.current_period_end) })
              }}
            </span>
          </template>
          <template v-else-if="store.isGuest">{{ t('billing.panel.guest') }}</template>
          <template v-else>{{ t('billing.panel.free') }}</template>
        </p>
      </div>
      <div class="bp-actions">
        <button
          v-if="!store.isGuest"
          class="bp-btn primary"
          @click="store.openPricing({ reason: 'menu' })"
        >
          <UiIcon v-if="!store.isPaid" name="sparkles" :size="16" />
          {{ store.isPaid ? t('billing.panel.change') : t('billing.panel.upgrade') }}
        </button>
        <button
          v-if="sub?.status === 'active' && !sub.cancel_at_period_end"
          class="bp-btn"
          :disabled="busy"
          @click="cancel"
        >
          {{ t('billing.panel.cancel') }}
        </button>
        <button
          v-if="sub?.status === 'active' && sub.cancel_at_period_end"
          class="bp-btn"
          :disabled="busy"
          @click="resume"
        >
          {{ t('billing.panel.resume') }}
        </button>
      </div>
    </div>

    <p v-if="provider === 'sandbox'" class="bp-note">
      <UiIcon name="flask-conical" :size="14" />
      <span>{{ t('billing.panel.sandboxNote') }}</span>
    </p>

    <div class="bp-invoices">
      <h3>{{ t('billing.panel.history') }}</h3>
      <table v-if="invoices.length">
        <thead>
          <tr>
            <th>{{ t('billing.panel.date') }}</th>
            <th>{{ t('billing.panel.number') }}</th>
            <th>{{ t('billing.panel.item') }}</th>
            <th>{{ t('billing.panel.amount') }}</th>
            <th>{{ t('billing.panel.status') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="inv in invoices" :key="inv.id">
            <td>{{ fmtDate(inv.created_at) }}</td>
            <td class="mono">{{ inv.number }}</td>
            <td>
              {{ t('billing.plans.' + inv.plan + '.name') }} ·
              {{ inv.interval === 'year' ? t('billing.yearly') : t('billing.monthly') }}
            </td>
            <td>{{ money(inv.amount, inv.currency) }}</td>
            <td>
              <span class="bp-status" :class="inv.status">{{
                t('billing.panel.inv.' + inv.status)
              }}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="bp-empty">{{ t('billing.panel.noInvoices') }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useI18n } from '../../i18n'
import { confirmDialog, toast } from '../../lib/dialogs.js'
import PlanBadge from './PlanBadge.vue'
import UiIcon from '../ui/UiIcon.js'
import { offerFor } from '../../../../shared/billing'

const store = useMainStore()
const { t, locale } = useI18n()
const busy = ref(false)

const plan = computed(() => store.authUser?.plan || 'free')
const offer = computed(() => offerFor(plan.value))
const sub = computed(() => store.billingStatus?.subscription ?? null)
const invoices = computed(() => store.billingStatus?.invoices ?? [])
const provider = computed(() => store.billingCatalog?.provider ?? 'none')

onMounted(() => store.loadBilling())

function money(cents, currency = 'USD') {
  return new Intl.NumberFormat(locale.value, { style: 'currency', currency }).format(cents / 100)
}
function fmtDate(s) {
  if (!s) return ''
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(
    new Date(s.replace(' ', 'T') + 'Z')
  )
}

async function cancel() {
  const ok = await confirmDialog({
    title: t('billing.panel.cancelTitle'),
    message: t('billing.panel.cancelBody', { date: fmtDate(sub.value.current_period_end) }),
    confirmLabel: t('billing.panel.cancelConfirm'),
    cancelLabel: t('billing.panel.keep'),
    tone: 'danger',
    icon: 'leaf'
  })
  if (!ok) return
  busy.value = true
  const res = await store.cancelSubscription()
  busy.value = false
  if (res.success) toast(t('billing.panel.canceledToast'), { tone: 'success' })
  else toast(res.error, { tone: 'error' })
}
async function resume() {
  busy.value = true
  const res = await store.resumeSubscription()
  busy.value = false
  if (res.success) toast(t('billing.panel.resumedToast'), { tone: 'success', icon: 'sprout' })
  else toast(res.error, { tone: 'error' })
}
</script>

<style scoped>
.bp {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.bp-plan {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding: 18px 20px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background:
    radial-gradient(120% 140% at 0% 0%, rgba(var(--accent-rgb), 0.1), transparent 60%),
    var(--surface);
}
.bp-plan.tier-pro {
  background:
    radial-gradient(120% 140% at 0% 0%, rgba(255, 196, 110, 0.16), transparent 60%), var(--surface);
}
.bp-plan-main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.bp-plan-line {
  margin: 0;
  font-size: 13px;
  color: var(--t2);
}
.bp-plan-line .warn {
  color: var(--amber);
  font-weight: 700;
}
.bp-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.bp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: var(--ctl-md);
  padding: 0 16px;
  border-radius: var(--r-md);
  border: 1px solid var(--border-strong);
  background: var(--elevated);
  color: var(--t1);
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
}
.bp-btn:hover:not(:disabled) {
  background: var(--hover);
}
.bp-btn.primary {
  border-color: transparent;
  color: var(--on-accent);
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: var(--glow);
}
.bp-note {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 0;
  font-size: 13px;
  color: var(--amber);
}
.bp-note .ui-icon {
  flex-shrink: 0;
  margin-top: 2px;
}
.bp-invoices h3 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 800;
  color: var(--t1);
}
.bp-invoices table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.bp-invoices th {
  text-align: left;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--t3);
  padding: 6px 8px;
}
.bp-invoices td {
  padding: 8px;
  border-top: 1px solid var(--border);
  color: var(--t1);
}
.mono {
  font-family: var(--mono);
  font-size: 12.5px;
}
.bp-status {
  padding: 2px 8px;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: 800;
}
.bp-status.paid {
  color: var(--green);
  background: rgba(76, 175, 114, 0.14);
}
.bp-status.failed {
  color: var(--danger);
  background: rgba(var(--danger-rgb), 0.12);
}
.bp-empty {
  margin: 0;
  font-size: 13px;
  color: var(--t3);
}
</style>
