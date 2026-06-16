import { BrowserRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AppLayout } from "@/components/layout/AppLayout"
import { StatusPage } from "@/pages/StatusPage"
import { AddPage } from "@/pages/AddPage"
import { PlanPage } from "@/pages/PlanPage"
import { DefinitionsPage } from "@/pages/DefinitionsPage"
import { TransactionsPage } from "@/pages/TransactionsPage"
import { HarcamalarPage } from "@/pages/HarcamalarPage"
import { HesaplarPage } from "@/pages/HesaplarPage"
import { BoxDetailPage } from "@/pages/BoxDetailPage"
import { RaporlarPage } from "@/pages/RaporlarPage"
import { FlowPage } from "@/pages/FlowPage"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<StatusPage />} />
            <Route path="ekle" element={<AddPage />} />
            <Route path="islemler" element={<TransactionsPage />} />
            <Route path="harcamalar" element={<HarcamalarPage />} />
            <Route path="hesaplar" element={<HesaplarPage />} />
            <Route path="hesaplar/:id" element={<BoxDetailPage />} />
            <Route path="plan" element={<PlanPage />} />
            <Route path="raporlar" element={<RaporlarPage />} />
            <Route path="akis" element={<FlowPage />} />
            <Route path="ayarlar" element={<DefinitionsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
