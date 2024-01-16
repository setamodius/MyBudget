<template>
  <q-page class>
    <q-card>
      <q-tabs
        v-model="tab"
        dense
        class="text-grey"
        active-color="primary"
        indicator-color="primary"
        align="justify"
        narrow-indicator
        @update:model-value="tabchanged()"
      >
        <q-tab name="incomes" label="INCOMES" />
        <q-tab name="creditcards" label="CREDIT CARDS" />
        <q-tab name="expensetypes" label="EXPENSES" />
      </q-tabs>

      <q-separator />
      <div class="row">
        <q-select
          class="q-ma-sm"
          style="max-width: 300px"
          :options="boxdata"
          v-model="selectedbox"
          option-label="name"
          @update:model-value="getReport()"
          emit-value
        ></q-select>
        <q-btn
          flat
          class="q-ma-sm q-pa-sm"
          @click="getallCreditCardsReport"
          color="primary"
          v-if="tab=== 'creditcards'"
        >Get All Credit Cards</q-btn>
        <q-btn
          flat
          class="q-ma-sm q-pa-sm"
          @click="getallExpensesReport"
          color="primary"
          v-if="tab=== 'expensetypes'"
        >Get All Expenses</q-btn>
      </div>

      <q-separator />
      <q-table
        :pagination="initialPagination"
        :rows="reportdata"
        :columns="columns"
        row-key="month"
        class="q-pa-sm q-gutter-sm"
        dense
        binary-state-sort
        @row-click="rowclicked"
        separator="cell"
        :title="selectedbox.name"
      >
        <template v-slot:header="props">
          <q-tr :props="props">
            <q-th auto-width />
            <q-th v-for="col in props.cols" :key="col.name" :props="props">{{ col.label }}</q-th>
          </q-tr>
        </template>

        <template v-slot:body="props">
          <q-tr :props="props">
            <q-td auto-width>
              <q-btn
                size="sm"
                color="accent"
                round
                dense
                @click="getTransactionsDetails(props)"
                :icon="props.expand ? 'remove' : 'add'"
              />
            </q-td>
            <q-td v-for="col in props.cols" :key="col.name" :props="props">{{ col.value }}</q-td>
          </q-tr>
          <q-tr v-show="props.expand" :props="props">
            <q-td colspan="100%">
              <q-tabs
                v-model="innertab"
                dense
                class="text-grey"
                active-color="primary"
                indicator-color="primary"
                align="justify"
                narrow-indicator
              >
                <q-tab name="income" label="INCOMES" />
                <q-tab name="expense" label="EXPENSES" />
              </q-tabs>

              <q-separator />

              <q-tab-panels v-model="innertab" animated>
                <q-tab-panel name="income">
                  <div class="row q-mb-sm">
                    <div class="text-subtitle1 text-weight-bold q-ml-sm">Total Income:</div>
                    <div class="text-subtitle1 q-ml-sm">
                      {{totalincomeamount.toLocaleString("tr-TR", {
                      style: "currency",
                      currency: "TRY",
                      })}}
                    </div>
                  </div>
                  <q-table
                    :pagination="initialPagination"
                    :rows="transactionsdataincome"
                    :columns="fromtransactioncolumns"
                    row-key="id"
                    class="q-pa-sm q-gutter-sm"
                    dense
                    binary-state-sort
                  ></q-table>
                </q-tab-panel>

                <q-tab-panel name="expense">
                  <div class="row q-mb-sm">
                    <div class="text-subtitle1 text-weight-bold q-ml-sm">Total Expense:</div>
                    <div class="text-subtitle1 q-ml-sm">
                      {{totalexpenseamount.toLocaleString("tr-TR", {
                      style: "currency",
                      currency: "TRY",
                      })}}
                    </div>
                  </div>
                  <q-table
                    :pagination="initialPagination"
                    :rows="transactionsdataexpense"
                    :columns="totransactioncolumns"
                    row-key="id"
                    class="q-pa-sm q-gutter-sm"
                    dense
                    binary-state-sort
                  ></q-table>
                </q-tab-panel>
              </q-tab-panels>
            </q-td>
          </q-tr>
        </template>
      </q-table>
      <q-separator />
    </q-card>
    <q-dialog v-model="show_detail_dialog">
      <q-card dense style="min-width: 350px">
        <q-card-section>
          <div>
            <div class="text-h6">Details</div>
            <q-tabs
              v-model="innertab"
              dense
              class="text-grey"
              active-color="primary"
              indicator-color="primary"
              align="justify"
              narrow-indicator
            >
              <q-tab name="income" label="INCOMES" />
              <q-tab name="expense" label="EXPENSES" />
            </q-tabs>

            <q-separator />

            <q-tab-panels v-model="innertab" animated>
              <q-tab-panel name="income">
                <div class="row q-mb-sm">
                  <div class="text-subtitle1 text-weight-bold q-ml-sm">Total Income:</div>
                  <div class="text-subtitle1 q-ml-sm">
                    {{totalincomeamount.toLocaleString("tr-TR", {
                    style: "currency",
                    currency: "TRY",
                    })}}
                  </div>
                </div>
                <q-table
                  :pagination="initialPagination"
                  :rows="transactionsdataincome"
                  :columns="fromtransactioncolumns"
                  row-key="id"
                  class="q-pa-sm q-gutter-sm"
                  dense
                  binary-state-sort
                ></q-table>
              </q-tab-panel>

              <q-tab-panel name="expense">
                <div class="row q-mb-sm">
                  <div class="text-subtitle1 text-weight-bold q-ml-sm">Total Expense:</div>
                  <div class="text-subtitle1 q-ml-sm">
                    {{totalexpenseamount.toLocaleString("tr-TR", {
                    style: "currency",
                    currency: "TRY",
                    })}}
                  </div>
                </div>
                <q-table
                  :pagination="initialPagination"
                  :rows="transactionsdataexpense"
                  :columns="totransactioncolumns"
                  row-key="id"
                  class="q-pa-sm q-gutter-sm"
                  dense
                  binary-state-sort
                ></q-table>
              </q-tab-panel>
            </q-tab-panels>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { api } from "boot/axios";
import { useQuasar, date } from "quasar";

const $q = useQuasar();

const tab = ref("incomes");
const innertab = ref("income");
const show_dialog = ref(false);

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
    name: "income",
    align: "center",
    label: "Income",
    field: "income",
    sortable: true,
    format: (val) =>
      parseFloat(val).toLocaleString("tr-TR", {
        style: "currency",
        currency: "TRY",
      }),
  });
  if (tab.value === "incomes" || tab.value === "creditcards") {
    result.push({
      name: "expense",
      align: "center",
      label: "Expense",
      field: "expense",
      sortable: true,
      format: (val) =>
        parseFloat(val).toLocaleString("tr-TR", {
          style: "currency",
          currency: "TRY",
        }),
    });
  } else {
    result.push({
      name: "planned",
      align: "center",
      label: "Planned",
      field: "planned",
      sortable: true,
      format: (val) =>
        parseFloat(val).toLocaleString("tr-TR", {
          style: "currency",
          currency: "TRY",
        }),
    });
  }
  if (tab.value === "incomes") {
    result.push({
      name: "balance",
      align: "center",
      label: "Montly Balance",
      field: "balance",
      sortable: true,
      format: (val) =>
        parseFloat(val).toLocaleString("tr-TR", {
          style: "currency",
          currency: "TRY",
        }),
    });

    result.push({
      name: "totalbalance",
      align: "center",
      label: "Total Balance",
      field: "total_balance",
      sortable: true,
      format: (val) =>
        parseFloat(val).toLocaleString("tr-TR", {
          style: "currency",
          currency: "TRY",
        }),
    });
  } else {
    result.push({
      name: "dept",
      align: "center",
      label: "Montly Dept",
      field: "dept",
      sortable: true,
      format: (val) =>
        parseFloat(val).toLocaleString("tr-TR", {
          style: "currency",
          currency: "TRY",
        }),
    });

    result.push({
      name: "totaldept",
      align: "center",
      label: "Total Dept",
      field: "total_dept",
      sortable: true,
      format: (val) =>
        parseFloat(val).toLocaleString("tr-TR", {
          style: "currency",
          currency: "TRY",
        }),
    });
  }
  return result;
});

const initialPagination = ref({
  rowsPerPage: 100,
  // rowsNumber: xx if getting data from a server
});

const boxdata = ref([]);
function getBoxData() {
  boxdata.value = [];
  api
    .get("/" + tab.value)
    .then((response) => {
      boxdata.value = response.data;
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

const boxes = ref([]);
function getAllBoxes() {
  api
    .get("/boxes", editedItem.value)
    .then((response) => {
      boxes.value = response.data;
    })
    .catch((error) => {
      $q.notify({
        color: "negative",
        position: "top",
        message: "Get boxes failed" + error,
        icon: "report_problem",
      });
    });
}

const selectedbox = ref({});
const reportdata = ref([]);
function getReport() {
  reportdata.value = [];
  api
    .get("/" + tab.value + "/" + selectedbox.value.id + "/reports/")
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

function getallCreditCardsReport() {
  reportdata.value = [];
  selectedbox.value.name = "All Credit Cards";
  api
    .get("/" + tab.value + "/reports/")
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

function getallExpensesReport() {
  reportdata.value = [];
  selectedbox.value.name = "All Expenses";
  api
    .get("/" + tab.value + "/reports/")
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

const editedItem = ref({});
function rowclicked(evt, row, index) {
  show_dialog.value = true;
  editedItem.value = row;
}

function updateBox() {
  api
    .put("/" + tab.value + "/" + editedItem.value.id, editedItem.value)
    .then((response) => {
      $q.notify({
        color: "positive",
        position: "top",
        message: "Box updated",
      });
      console.log(response.data);
      getBoxData();
    })
    .catch((error) => {
      $q.notify({
        color: "negative",
        position: "top",
        message: "Update failed" + error,
        icon: "report_problem",
      });
    });
}
function addbox() {
  show_dialog.value = true;
  delete editedItem.value.id;
}
function dialogAddBox() {
  api
    .post("/" + tab.value + "/", editedItem.value)
    .then((response) => {
      $q.notify({
        color: "positive",
        position: "top",
        message: "Box added",
      });
      console.log(response.data);
      getBoxData();
    })
    .catch((error) => {
      $q.notify({
        color: "negative",
        position: "top",
        message: "Add failed" + error,
        icon: "report_problem",
      });
    });
}

function dialogDeleteBox() {
  api
    .delete("/" + tab.value + "/" + editedItem.value.id, editedItem.value)
    .then((response) => {
      $q.notify({
        color: "positive",
        position: "top",
        message: "Box deleted",
      });
      console.log(response.data);
      getBoxData();
    })
    .catch((error) => {
      $q.notify({
        color: "negative",
        position: "top",
        message: "Delete failed" + error,
        icon: "report_problem",
      });
    });
}
const totransactioncolumns = [
  {
    name: "date",
    align: "center",
    label: "Date",
    field: "date",
    sortable: true,
    format: (val) => date.formatDate(val, "YYYY-MM-DD"),
  },
  {
    name: "tobox",
    align: "center",
    label: "To",
    field: "tobox",
    sortable: true,
    format: (val) => idname(val),
  },
  {
    name: "description",
    align: "center",
    label: "Description",
    field: "description",
    sortable: true,
  },
  {
    name: "amount",
    align: "center",
    label: "Amount",
    field: "amount",
    sortable: true,
    format: (val) =>
      parseFloat(val).toLocaleString("tr-TR", {
        style: "currency",
        currency: "TRY",
      }),
  },
];
const fromtransactioncolumns = [
  {
    name: "date",
    align: "center",
    label: "Date",
    field: "date",
    sortable: true,
    format: (val) => date.formatDate(val, "YYYY-MM-DD"),
  },
  {
    name: "frombox",
    align: "center",
    label: "From",
    field: "frombox",
    sortable: true,
    format: (val) => idname(val),
  },
  {
    name: "description",
    align: "center",
    label: "Description",
    field: "description",
    sortable: true,
  },
  {
    name: "amount",
    align: "center",
    label: "Amount",
    field: "amount",
    sortable: true,
    format: (val) =>
      parseFloat(val).toLocaleString("tr-TR", {
        style: "currency",
        currency: "TRY",
      }),
  },
];
const transactionsdataincome = ref([]);
const transactionsdataexpense = ref([]);
const totalincomeamount = ref(0);
const totalexpenseamount = ref(0);
const show_detail_dialog = ref(false);
function getTransactionsDetails(props) {
  show_detail_dialog.value = true;
  var queryparams = new URLSearchParams();
  const enddate = date.formatDate(
    date.addToDate(props.row.month, { months: 1, days: -1 })
  );

  queryparams.append("to", selectedbox.value.id);
  queryparams.append("start", props.row.month);
  queryparams.append("end", enddate);

  transactionsdataincome.value = [];
  api
    .get("/transactions", { params: queryparams })
    .then((response) => {
      transactionsdataincome.value = response.data;
      totalincomeamount.value = 0;
      transactionsdataincome.value.forEach((element) => {
        totalincomeamount.value += parseFloat(element.amount);
      });
    })
    .catch((error) => {
      console.log(error);
      $q.notify({
        color: "negative",
        position: "top",
        message: "Transaction get error",
        icon: "report_problem",
      });
    });

  queryparams.delete("to");
  queryparams.append("from", selectedbox.value.id);
  transactionsdataexpense.value = [];
  api
    .get("/transactions", { params: queryparams })
    .then((response) => {
      transactionsdataexpense.value = response.data;
      totalexpenseamount.value = 0;
      transactionsdataexpense.value.forEach((element) => {
        totalexpenseamount.value += parseFloat(element.amount);
      });
    })
    .catch((error) => {
      console.log(error);
      $q.notify({
        color: "negative",
        position: "top",
        message: "Transaction get error",
        icon: "report_problem",
      });
    });
}

function idname(value) {
  let s = boxes.value.find((element) => element.id === value);

  if (s !== undefined) {
    return s.name;
  } else {
    return "-";
  }
}

function tabchanged() {
  reportdata.value = [];
  getBoxData();
}
onMounted(() => {
  getAllBoxes();
  getBoxData();
});
</script>