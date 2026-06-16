import client from "./client"
import type { Balance } from "@/types"

export const getBalances = async (asOf?: string): Promise<Balance[]> => {
  const { data } = await client.get("/balances", { params: asOf ? { asOf } : undefined })
  return data
}
