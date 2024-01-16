<template>
  <q-page class>
    <q-card>
      <div class="row q-pa-sm">
        <q-select
          dense
          class="col-2"
          filled
          v-model="fromboxfilter"
          :options="filterboxes"
          label="From"
          option-label="name"
          option-value="id"
          map-options
          emit-value
          @update:model-value="getTransactionsData()"
        />
        <q-select
          dense
          class="q-ml-sm col-2"
          filled
          v-model="toboxfilter"
          :options="filterboxes"
          label="To"
          option-label="name"
          option-value="id"
          map-options
          emit-value
          @update:model-value="getTransactionsData()"
        />

        <q-input
          class="q-ml-sm"
          dense
          filled
          v-model="startdate"
          mask="date"
          :rules="['date']"
          @update:model-value="getTransactionsData()"
        >
          <template v-slot:append>
            <q-icon name="event" class="cursor-pointer">
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-date v-model="startdate" @update:model-value="getTransactionsData()">
                  <div class="row items-center justify-end">
                    <q-btn v-close-popup label="Close" color="primary" flat />
                  </div>
                </q-date>
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>

        <q-input
          class="q-ml-sm"
          dense
          filled
          v-model="enddate"
          mask="date"
          :rules="['date']"
          @update:model-value="getTransactionsData()"
        >
          <template v-slot:append>
            <q-icon name="event" class="cursor-pointer">
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-date v-model="enddate" @update:model-value="getTransactionsData()">
                  <div class="row items-center justify-end">
                    <q-btn v-close-popup label="Close" color="primary" flat />
                  </div>
                </q-date>
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>

        <q-btn dense flat class="q-pl-sm" @click="addColumn" color="primary">Add Column</q-btn>
      </div>

      <q-separator />
      <q-table
        title="Transactions"
        :pagination="initialPagination"
        :rows="transactionsdata"
        :columns="columns"
        row-key="id"
        class="q-pa-sm q-gutter-sm"
        dense
        :filter="filter"
        binary-state-sort
        @row-click="rowclicked"
      >
        <template v-slot:top-right>
          <q-input borderless dense debounce="300" v-model="filter" placeholder="Search">
            <template v-slot:append>
              <q-icon name="search" />
            </template>
          </q-input>
        </template>
      </q-table>
      <div class="row">
        <div class="text-subtitle1 text-weight-bold q-ml-sm">Total:</div>
        <div class="text-subtitle1 q-ml-sm">
          {{totalamount.toLocaleString("tr-TR", {
          style: "currency",
          currency: "TRY",
          })}}
        </div>
      </div>
      <q-separator />
      <q-btn
        flat
        outline
        dense
        class="q-ma-sm"
        color="primary"
        label="Add row"
        @click="addTransaction()"
      ></q-btn>
    </q-card>
    <div class="q-pa-sm q-gutter-sm">
      <q-dialog v-model="show_dialog">
        <q-card dense style="min-width: 450px">
          <q-card-section>
            <div class="text-h6">Edit Transaction</div>
          </q-card-section>

          <q-card-section>
            <div>
              <q-input dense v-model="editedItem.date" filled type="date" mask="YYYY-MM-DD" />

              <div class="row q-my-sm">
                <q-select
                  dense
                  class="col-5"
                  filled
                  v-model="editedItem.frombox"
                  :options="boxes"
                  label="From"
                  option-label="name"
                  option-value="id"
                  map-options
                  emit-value
                />
                <q-select
                  dense
                  class="q-ml-sm col-5"
                  filled
                  v-model="editedItem.tobox"
                  :options="boxes"
                  label="To"
                  option-label="name"
                  option-value="id"
                  map-options
                  emit-value
                />
              </div>

              <q-input v-model="editedItem.description" label="Description"></q-input>
              <q-input type="number" v-model.number="editedItem.amount" label="Amount"></q-input>
              <InfoEditor v-model="editedItem.info"></InfoEditor>
            </div>
          </q-card-section>
          <q-card-actions align="center">
            <q-btn
              flat
              v-if="editedItem.id"
              label="Delete"
              color="negative"
              v-close-popup
              @click="dialogDeleteTransaction"
            ></q-btn>
          </q-card-actions>
          <q-card-actions align="right">
            <q-btn flat label="Cancel" color="primary" v-close-popup></q-btn>

            <q-btn flat label="Update" color="primary" v-close-popup @click="updateTransaction"></q-btn>
          </q-card-actions>
        </q-card>
      </q-dialog>
      <q-dialog v-model="show_add_dialog">
        <q-card dense style="min-width: 350px">
          <q-card-section>
            <div class="text-h6">Add box</div>
          </q-card-section>

          <q-card-section>
            <div>
              <q-input filled v-model="addItem.date" mask="date" :rules="['date']">
                <template v-slot:append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date v-model="addItem.date">
                        <div class="row items-center justify-end">
                          <q-btn v-close-popup label="Close" color="primary" flat />
                        </div>
                      </q-date>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
              <div class="row">
                <q-select
                  class="q-mr-sm col-5"
                  filled
                  v-model="addItem.frombox"
                  :options="boxes"
                  label="From"
                  option-label="name"
                  option-value="id"
                  map-options
                  emit-value
                />
                <q-select
                  class="q-mx-sm col-5"
                  filled
                  v-model="addItem.tobox"
                  :options="boxes"
                  label="To"
                  option-label="name"
                  option-value="id"
                  map-options
                  emit-value
                />
              </div>

              <q-input v-model="addItem.description" label="Description"></q-input>
              <q-input type="number" v-model.number="addItem.amount" label="Amount"></q-input>
              <InfoEditor v-model="editedItem.info"></InfoEditor>
            </div>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="Cancel" color="primary" v-close-popup></q-btn>
            <q-btn flat label="Add" color="primary" v-close-popup @click="dialogAddTransaction"></q-btn>
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { api } from "boot/axios";
import { useQuasar, date } from "quasar";
import InfoEditor from "../components/InfoEditor.vue";

const $q = useQuasar();

const show_dialog = ref(false);
const show_add_dialog = ref(false);
const filter = ref("");
const options = ref({ mode: "code" });
const columns = ref([
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
  {
    name: "installments",
    align: "center",
    label: "Installments",
    field: "info",
    sortable: true,
    format: (val) => parseInfo(val, "Installments"),
  },
]);
const initialPagination = ref({
  rowsPerPage: 100,
  // rowsNumber: xx if getting data from a server
});

const start = date.subtractFromDate(new Date(), {
  days: new Date().getDate() - 1,
});
const enddate = ref(
  date.formatDate(date.addToDate(start, { months: 1, days: -1 }))
);
const startdate = ref(date.formatDate(start));
const fromboxfilter = ref({});
const toboxfilter = ref({});
const transactionsdata = ref([]);
const totalamount = ref(0);
function getTransactionsData() {
  var queryparams = new URLSearchParams();

  if (fromboxfilter.value !== -1) {
    queryparams.append("from", fromboxfilter.value);
  }
  if (toboxfilter.value !== -1) {
    queryparams.append("to", toboxfilter.value);
  }
  queryparams.append("start", startdate.value);
  queryparams.append("end", enddate.value);

  transactionsdata.value = [];
  api
    .get("/transactions", { params: queryparams })
    .then((response) => {
      transactionsdata.value = response.data;
      totalamount.value = 0;
      transactionsdata.value.forEach((element) => {
        totalamount.value += parseFloat(element.amount);
      });
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

function updateTransaction() {
  api
    .put("/transactions/" + editedItem.value.id, editedItem.value)
    .then((response) => {
      $q.notify({
        color: "positive",
        position: "top",
        message: "Transaction updated",
      });
      getTransactionsData();
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
const addItem = ref({ info: {} });
function addTransaction() {
  show_add_dialog.value = true;
}
function dialogAddTransaction() {
  api
    .post("/transactions/", addItem.value)
    .then((response) => {
      $q.notify({
        color: "positive",
        position: "top",
        message: "Transaction added",
      });

      getTransactionsData();
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

function dialogDeleteTransaction() {
  api
    .delete("/transactions/" + editedItem.value.id, editedItem.value)
    .then((response) => {
      $q.notify({
        color: "positive",
        position: "top",
        message: "Transaction deleted",
      });

      getTransactionsData();
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

const boxes = ref([]);
const filterboxes = ref([]);
function getBoxes() {
  api
    .get("/boxes", editedItem.value)
    .then((response) => {
      boxes.value = response.data;
      filterboxes.value = [{ name: "ALL", id: -1 }].concat(response.data);
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

function idname(value) {
  let s = boxes.value.find((element) => element.id === value);

  if (s !== undefined) {
    return s.name;
  } else {
    return "d";
  }
}

function parseInfo(value, key) {
  if (value !== undefined && value !== null) {
    return value[key];
  } else {
    return "";
  }
}

function addColumn() {
  columns.value.push({
    name: "dede",
    align: "center",
    label: "dede",
    field: "info",
    sortable: true,
    format: (val) => parseInfo(val, "Consumption"),
  });
  //columns.value.splice(columns.value.length - 1, 1);
  getTransactionsData();
}

onMounted(() => {
  getBoxes();
  getTransactionsData();
});
</script>