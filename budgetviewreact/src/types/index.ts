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
  expense_box_id: number
  expense_name: string
  payment_box_id: number | null
  payment_box_name: string | null
  start_date: string
  total_installments: number
  amount_per_month: string
  total_amount: string
  elapsed_count: string
}

export interface InstallmentPlanDetail {
  id: number
  date: string
  amount: string
  installment_no: number
  total: number
}

export interface InstallmentPlanFormData {
  description: string
  expense_box_id: number
  payment_box_id?: number | null
  start_date: string
  total_installments: number
  total_amount: number
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
