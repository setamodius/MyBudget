<template>
  <q-page>
    <div class="q-ma-sm row">
      <q-select
        class="q-ma-sm"
        style="max-width: 300px"
        :options="types"
        v-model="selectedtype"
        option-label="name"
        @update:model-value="getReportType()"
        emit-value
      >
      </q-select>
      <q-btn
        flat
        class="q-ma-sm q-pa-sm"
        @click="getallBanksReport"
        color="primary"
        >Get All Expenses</q-btn
      >
    </div>

    <q-table
      :title="selectedtype.name"
      :pagination="initialPagination"
      :rows="data"
      :columns="columns"
      row-key="id"
      class="q-pa-sm q-gutter-sm"
      dense
      binary-state-sort
    >
      <template v-slot:body="props">
        <q-tr :props="props">
          <q-td key="month" :props="props">
            {{ date.formatDate(props.row.month, "MMMM - YYYY") }}
          </q-td>
          <q-td key="dept" :props="props">
            {{ props.row.dept }}
          </q-td>

          <q-td key="payload" :props="props">
            <div class="text-pre-wrap">{{ props.row.payload }}</div>
          </q-td>

          <q-td key="remaining" :props="props">
            {{ props.row.tobepaid }}
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { api } from "boot/axios";
import { useQuasar, date } from "quasar";

const $q = useQuasar();
const data = ref([]);

const columns = [
  {
    name: "month",
    align: "center",
    label: "Month",
    field: "month",
    sortable: true,
  },
  {
    name: "dept",
    align: "center",
    label: "Dept",
    field: "dept",
    sortable: true,
  },
  {
    name: "payload",
    align: "center",
    label: "Payload",
    field: "payload",
    sortable: true,
  },

  {
    name: "remaining",
    align: "center",
    label: "Remaining",
    field: "tobepaid",
    sortable: true,
  },
];
const initialPagination = ref({
  rowsPerPage: 100,
  // rowsNumber: xx if getting data from a server
});

const types = ref([]);
const selectedtype = ref({});
function getTypes() {
  api
    .get("/expenses")
    .then((response) => {
      types.value = response.data;
      if (types.value.length > 0) {
        //selectedbank.value = banks.value[0];
      }
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

function getReportType() {
  const params = new URLSearchParams([
    ["start", "2022-01-01"],
    ["end", "2023-01-01"],
  ]);
  api
    .get("/expenses/" + selectedtype.value.id + "/summary", { params })
    .then((response) => {
      data.value = response.data;
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

function getallBanksReport() {
  const params = new URLSearchParams([
    ["start", "2022-01-01"],
    ["end", "2023-01-01"],
  ]);
  api
    .get("/expenses/summary", { params })
    .then((response) => {
      selectedtype.value = { id: 0, name: "All Expenses" };
      data.value = response.data;
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
  getTypes();
});
</script>
