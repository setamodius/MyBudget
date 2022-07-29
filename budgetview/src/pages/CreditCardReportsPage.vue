<template>
  <q-page>
    <div class="q-ma-sm row">
      <q-select
        class="q-ma-sm"
        style="max-width: 300px"
        :options="banks"
        v-model="selectedbank"
        option-label="name"
        @update:model-value="getBankReport()"
        emit-value
      >
      </q-select>
      <q-btn
        flat
        class="q-ma-sm q-pa-sm"
        @click="getallBanksReport"
        color="primary"
        >Get All Credit Cards</q-btn
      >
    </div>

    <q-table
      :title="selectedbank.name"
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
          <q-td key="cumulativedept" :props="props">
            {{ props.row.cum_dept }}
          </q-td>
          <q-td key="payload" :props="props">
            <div class="text-pre-wrap">{{ props.row.payload }}</div>
          </q-td>
          <q-td key="cumulativepayload" :props="props">
            {{ props.row.cum_payload }}
          </q-td>
          <q-td key="remaining" :props="props">
            {{ props.row.tobepaid }}
          </q-td>
        </q-tr>
      </template>
    </q-table>
    <div class="q-pa-sm q-gutter-sm">
      <q-dialog v-model="show_dialog">
        <q-card>
          <q-card-section>
            <div class="text-h6">Add new item!</div>
          </q-card-section>

          <q-card-section>
            <div class="">
              <q-date landscape v-model="editedItem.date" />

              <q-input
                v-model="editedItem.description"
                label="Description"
              ></q-input>
              <q-input
                type="number"
                v-model.number="editedItem.installments"
                label="Installments"
              ></q-input>
              <q-input
                type="number"
                v-model.number="editedItem.amount"
                label="Amount"
              ></q-input>
              <q-input
                type="number"
                v-model.number="editedItem.paid"
                label="Paid"
              ></q-input>
            </div>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn
              flat
              label="OK"
              color="primary"
              v-close-popup
              @click="addRow"
            ></q-btn>
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { api } from "boot/axios";
import { useQuasar, date } from "quasar";

const $q = useQuasar();
const data = ref([]);

const show_dialog = ref(false);
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
    name: "cumulativedept",
    align: "center",
    label: "Cumulative Dept",
    field: "cum_dept",
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
    name: "cumulativepayload",
    align: "center",
    label: "Cumulative Payload",
    field: "cum_payload",
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

const banks = ref([]);
const selectedbank = ref({});
function getBanks() {
  api
    .get("/creditcard")
    .then((response) => {
      banks.value = response.data;
      if (banks.value.length > 0) {
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

function getBankReport() {
  const params = new URLSearchParams([
    ["start", "2022-01-01"],
    ["end", "2023-01-01"],
  ]);
  api
    .get("/creditcard/" + selectedbank.value.id + "/summary", { params })
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
    .get("/creditcard/summary", { params })
    .then((response) => {
      selectedbank.value = { id: 0, name: "All Credit Cards" };
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
  getBanks();
});
</script>
