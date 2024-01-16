const routes = [
  {
    path: "/",
    component: () => import("layouts/MainLayout.vue"),
    children: [
      { path: "", component: () => import("pages/Index.vue") },

      {
        path: "/creditcardtransactions",
        component: () => import("pages/CreditCardTransactionsPage.vue"),
      },
      {
        path: "/expensetransactions",
        component: () => import("pages/ExpenseTransactionsPage.vue"),
      },
      {
        path: "/creditcardreports",
        component: () => import("pages/CreditCardReportsPage.vue"),
      },
      {
        path: "/expensereports",
        component: () => import("pages/ExpenseReportsPage.vue"),
      },
      {
        path: "/definitions",
        component: () => import("pages/DefinitionsPage.vue"),
      },
      {
        path: "/transactions",
        component: () => import("pages/TransactionsPage.vue"),
      },
      {
        path: "/reports",
        component: () => import("pages/ReportsPage.vue"),
      },
      {
        path: "/summaries",
        component: () => import("pages/SummariesPage.vue"),
      },
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: "/:catchAll(.*)*",
    component: () => import("pages/Error404.vue"),
  },
];

export default routes;
