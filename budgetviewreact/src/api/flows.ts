import client from "./client"

export interface Flow {
  frombox: number
  from_name: string
  from_type: string
  tobox: number
  to_name: string
  to_type: string
  total: string
}

export const getFlows = async (start?: string, end?: string): Promise<Flow[]> => {
  const params: Record<string, string> = {}
  if (start) params.start = start
  if (end) params.end = end
  const { data } = await client.get("/flows", { params })
  return data
}
