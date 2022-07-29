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
      <q-select
        class="q-ma-sm"
        style="max-width: 300px"
        :options="boxdata"
        v-model="selectedbox"
        option-label="name"
        @update:model-value="getReport()"
        emit-value
      ></q-select>
      <q-separator />
      <q-table
        :pagination="initialPagination"
        :rows="reportdata"
        :columns="columns"
        row-key="id"
        class="q-pa-sm q-gutter-sm"
        dense
        binary-state-sort
        @row-click="rowclicked"
        separator="cell"
      />
      <q-separator />
      <q-btn flat outline dense class="q-ma-sm" color="primary" label="Add row" @click="addbox()"></q-btn>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { api } from "boot/axios";
import { useQuasar, date } from "quasar";

const $q = useQuasar();

const tab = ref("incomes");
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
  });
  if (tab.value === "incomes" || tab.value === "creditcards") {
    result.push({
      name: "expense",
      align: "center",
      label: "Expense",
      field: "expense",
      sortable: true,
    });
  } else {
    result.push({
      name: "planned",
      align: "center",
      label: "Planned",
      field: "planned",
      sortable: true,
    });
  }

  result.push({
    name: "dept",
    align: "center",
    label: "Montly Dept",
    field: "dept",
    sortable: true,
  });

  result.push({
    name: "totaldept",
    align: "center",
    label: "Total Dept",
    field: "total_dept",
    sortable: true,
  });
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
function tabchanged() {
  reportdata.value = [];
  getBoxData();
}
onMounted(() => {
  getBoxData();
});
</script>