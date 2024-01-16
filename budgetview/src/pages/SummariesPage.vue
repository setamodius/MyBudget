<template>
  <q-page class>
    <q-card>
      <q-table
        :pagination="initialPagination"
        :rows="reportdata"
        :columns="columns"
        row-key="month"
        class="q-pa-sm q-gutter-sm"
        dense
        binary-state-sort
        separator="cell"
        title="Summary"
      ></q-table>
      <q-separator />
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { api } from "boot/axios";
import { useQuasar, date } from "quasar";

const $q = useQuasar();

const columns = computed(() => {
  let result = [];
  result.push({
    name: "month",
    align: "center",
    label: "Month",
    field: "month",
    sortable: true,
    format: (val) => date.formatDate(val, "MMMM-YYYY"),
  });

  result.push({
    name: "creditcardexpense",
    align: "center",
    label: "Credit Card Expense",
    field: "t_creditcard_expense",
    sortable: true,
    format: (val) =>
      parseFloat(val).toLocaleString("tr-TR", {
        style: "currency",
        currency: "TRY",
      }),
  });
  result.push({
    name: "directexpense",
    align: "center",
    label: "Direct Expense",
    field: "t_direct_expense",
    sortable: true,
    format: (val) =>
      parseFloat(val).toLocaleString("tr-TR", {
        style: "currency",
        currency: "TRY",
      }),
  });
  result.push({
    name: "totalexpense",
    align: "center",
    label: "Total Expense",
    field: "t_expense",
    sortable: true,
    format: (val) =>
      parseFloat(val).toLocaleString("tr-TR", {
        style: "currency",
        currency: "TRY",
      }),
  });
  result.push({
    name: "income",
    align: "center",
    label: "Income",
    field: "t_income",
    sortable: true,
    format: (val) =>
      parseFloat(val).toLocaleString("tr-TR", {
        style: "currency",
        currency: "TRY",
      }),
  });
  result.push({
    name: "balance",
    align: "center",
    label: "Balance",
    field: "balance",
    sortable: true,
    format: (val) =>
      parseFloat(val).toLocaleString("tr-TR", {
        style: "currency",
        currency: "TRY",
      }),
  });
  return result;
});

const initialPagination = ref({
  rowsPerPage: 100,
  // rowsNumber: xx if getting data from a server
});

const reportdata = ref([]);
function getReport() {
  reportdata.value = [];
  api
    .get("/summaries/")
    .then((response) => {
      reportdata.value = response.data;
    })
    .catch(() => {
      $q.notify({
        color: "negative",
        position: "top",
        message: "Loading failed",
        icon: "report_problem",
      });
    });
}

onMounted(() => {
  getReport();
});
</script>