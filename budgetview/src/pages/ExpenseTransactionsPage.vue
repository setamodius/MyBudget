<template>
  <q-page>
    <div class="q-ma-sm">
      <q-select
        class="q-ma-sm"
        style="max-width: 300px"
        :options="types"
        v-model="selectedtype"
        option-label="name"
        @update:model-value="deneme()"
        emit-value
      >
      </q-select>
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
          <q-td key="date" :props="props">
            {{ date.formatDate(props.row.date, "DD-MM-YYYY") }}
            <q-popup-edit v-model="props.row.date">
              <q-date landscape v-model="props.row.date" />
            </q-popup-edit>
          </q-td>
          <q-td key="description" :props="props">
            {{ props.row.description }}
            <q-popup-edit v-model="props.row.description" title="Update date">
              <q-input
                v-model="props.row.description"
                dense
                autofocus
              ></q-input>
            </q-popup-edit>
          </q-td>
          <q-td key="installments" :props="props">
            <div class="text-pre-wrap">{{ props.row.installments }}</div>
            <q-popup-edit v-model="props.row.installments">
              <q-input
                type="number"
                v-model="props.row.installments"
                dense
                autofocus
              ></q-input>
            </q-popup-edit>
          </q-td>
          <q-td key="amount" :props="props">
            {{ props.row.amount }}
            <q-popup-edit
              v-model="props.row.amount"
              title="Update carbs"
              buttons
              persistent
            >
              <q-input
                type="number"
                v-model="props.row.amount"
                dense
                autofocus
                hint="Use buttons to close"
              ></q-input>
            </q-popup-edit>
          </q-td>
          <q-td key="paid" :props="props">
            {{ props.row.paid }}
            <q-popup-edit
              v-model="props.row.paid"
              title="Update paid"
              buttons
              persistent
            >
              <q-input
                type="number"
                v-model="props.row.paid"
                dense
                autofocus
                hint="Use buttons to close"
              ></q-input>
            </q-popup-edit>
          </q-td>

          <q-td key="actions" :props="props">
            <q-btn
              color="blue"
              icon="sync"
              @click="editItem(props.row)"
              size="sm"
            ></q-btn>
            <q-btn
              color="red"
              class="q-ml-sm"
              icon="delete"
              @click="deleteItem(props.row)"
              size="sm"
            ></q-btn>
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
    <q-btn
      flat
      outline
      dense
      color="primary"
      label="Add row"
      @click="show_dialog = true"
    ></q-btn>
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
    name: "date",
    align: "center",
    label: "Date",
    field: "date",
    sortable: true,
  },
  {
    name: "description",
    align: "center",
    label: "Description",
    field: "description",
    sortable: true,
  },
  {
    name: "installments",
    align: "center",
    label: "Installments",
    field: "installments",
    sortable: true,
  },
  {
    name: "amount",
    align: "center",
    label: "Amount",
    field: "amount",
    sortable: true,
  },
  {
    name: "paid",
    align: "center",
    label: "Paid",
    field: "paid",
    sortable: true,
  },

  {
    name: "actions",
    label: "Actions",
    field: "actions",
  },
];
const initialPagination = ref({
  rowsPerPage: 100,
  // rowsNumber: xx if getting data from a server
});

const types = ref([]);
const selectedtype = ref({});
function getBanks() {
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

function deneme() {
  api
    .get("/expenses/" + selectedtype.value.id + "/transactions")
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

const editedItem = ref({});
function addRow() {
  api
    .post(
      "/expenses/" + selectedtype.value.id + "/transactions",
      editedItem.value
    )
    .then((response) => {
      $q.notify({
        color: "positive",
        position: "top",
        message: "Item added",
      });
      console.log(response.data);
      deneme();
    })
    .catch(() => {
      $q.notify({
        color: "negative",
        position: "top",
        message: "Add failed",
        icon: "report_problem",
      });
    });
}

function deleteItem(row) {
  api
    .delete("/expenses/" + selectedtype.value.id + "/transactions/" + row.id)
    .then((response) => {
      $q.notify({
        color: "positive",
        position: "top",
        message: "Item deleted",
      });
      console.log(response.data);
      deneme();
    })
    .catch(() => {
      $q.notify({
        color: "negative",
        position: "top",
        message: "Delete failed",
        icon: "report_problem",
      });
    });
}
function editItem(row) {
  api
    .put("/expenses/" + selectedtype.value.id + "/transactions/" + row.id, row)
    .then((response) => {
      $q.notify({
        color: "positive",
        position: "top",
        message: "Item updated",
      });
      console.log(response.data);
      deneme();
    })
    .catch(() => {
      $q.notify({
        color: "negative",
        position: "top",
        message: "Update failed",
        icon: "report_problem",
      });
    });
}

onMounted(() => {
  getBanks();
});
</script>
