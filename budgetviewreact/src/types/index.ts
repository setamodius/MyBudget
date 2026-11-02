export interface Box {
  id: number
  boxtypeid: number
  name: string
  settlement: number | null
  payment: number | null
  minuslimit: number | null
  pluslimit: number | null
}

export interface BoxTypeInfo {
  id: number
  name: string
}

export type BoxType =
  | "incomes" | "creditcards" | "expensetypes"
  | "storages" | "investments" | "generators" | "destroyers"

export interface BoxDirection {
  id: number
  from_typeid: number
  from_name: string
  to_typeid: number
  to_name: string
}

export interface Transaction {
  id: number
  date: string
  frombox: number
  tobox: number
  description: string
  amount: string
  info: Record<string, string> | null
}

export interface TransactionFilters {
  from?: number
  to?: number
  start?: string
  end?: string
}

export interface Summary {
  month: string
  t_income: string
  t_creditcard_expense: string
  t_direct_expense: string
  t_expense: string
  t_cc_pending?: string
  balance: string
}

export interface BoxReport {
  month: string
  income: string
  expense: string
  balance?: string
  total_balance?: string
  dept?: string
  total_dept?: string
  planned?: string
  cash?: string
  cc_this_cycle?: string
  cc_next_cycle?: string
  // Expense report renamed fields
  charged?: string
  settled?: string
  net?: string
  total_net?: string
}

export interface BoxFormData {
  name: string
  settlement?: number | null
  payment?: number | null
  minuslimit?: number | null
  pluslimit?: number | null
}

export interface TransactionFormData {
  date: string
  frombox: number
  tobox: number
  description: string
  amount: number
  info: Record<string, string>
}

export interface Balance {
  id: number
  name: string
  boxtypeid: number
  balance: string
}

export interface InstallmentPlan {
  id: number
  description: string
  merchant: string | null
  expense_box_id: number
  expense_name: string
  payment_box_id: number | null
  payment_box_name: string | null
  start_date: string
  purchase_date: string
  first_no: number
  total_installments: number
  amount_per_month: string
  total_amount: string
  elapsed_count: string
  paid_count: number
}

export interface InstallmentPlanDetail {
  id: number
  date: string
  amount: string
  installment_no: number
  total: number
  has_budget: boolean
  actual_id: number | null
  actual_date: string | null
  actual_amount: string | null
}

export interface InstallmentPlanFormData {
  description: string
  merchant?: string
  expense_box_id: number
  payment_box_id?: number | null
  start_date?: string
  purchase_date?: string
  total_installments: number
  total_amount?: number
  amount_per_month?: number
  first_no?: number
  card_txns?: boolean
  auto_link?: boolean
  link_tx_ids?: number[]
  delete_tx_ids?: number[]
  replace_plan_ids?: number[]
}

export interface InstallmentResolveRow {
  key: string
  description: string
  date: string
  no: number
  total: number
  amount: number
}

export interface InstallmentResolveResult {
  key: string
  purchase_date: string
  plan_id: number | null
  plan_description: string | null
  expense_box_id: number | null
  duplicate_tx_id: number | null
  unlinked_tx_ids: number[]
  first_no: number
}

export interface InstallmentScanTx {
  id: number
  date: string
  no: number
  amount: number
  to_name: string
  plan_id: number | null
}

export interface InstallmentScanGroup {
  key: string
  card: number
  card_name: string
  description: string
  merchant: string
  purchase_date: string
  total: number
  amount: number
  min_no: number
  max_no: number
  finished: boolean
  issues: ("no_plan" | "multi_plan" | "plan_mismatch" | "partial_link" | "mixed_category")[]
  action: "create" | "link"
  categories: string[]
  suggested_category: number
  suggested_description: string
  plan_id: number | null
  plan_description: string | null
  plan_total: number | null
  replace_plan_ids: number[]
  tx_ids: number[]
  txs: InstallmentScanTx[]
  lumps: { id: number; date: string; amount: number; description: string; to_name: string }[]
}

export interface InstallmentScanPlan {
  plan_id: number
  description: string
  expense_name: string
  payment_box_name: string | null
  amount_per_month: number
  total_installments: number
  missing_budget: number[]
  candidates: { installment_no: number; id: number; date: string; amount: number; description: string; from_name: string; to_name: string }[]
}

export interface InstallmentScan {
  groups: InstallmentScanGroup[]
  plans: InstallmentScanPlan[]
}

export interface ExpenseBreakdown {
  name: string
  total: string
}

export interface PeriodSummaryRow {
  id: number
  name: string
  boxtypeid: number
  type: string
  total_in: string
  total_out: string
  net: string
}
