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
      <q-table
        :pagination="initialPagination"
        :rows="boxdata"
        :columns="columns"
        row-key="id"
        class="q-pa-sm q-gutter-sm"
        dense
        binary-state-sort
        @row-click="rowclicked"
      />
      <q-separator />
      <q-btn flat outline dense class="q-ma-sm" color="primary" label="Add row" @click="addbox()"></q-btn>
    </q-card>
    <div class="q-pa-sm q-gutter-sm">
      <q-dialog v-model="show_dialog">
        <q-card dense style="min-width: 350px">
          <q-card-section>
            <div v-if="editedItem.id" class="text-h6">Edit box</div>
            <div v-else class="text-h6">Add box</div>
          </q-card-section>

          <q-card-section>
            <div>
              <q-input v-model="editedItem.name" label="Name"></q-input>
              <q-input type="number" v-model.number="editedItem.settlement" label="Settlement Day"></q-input>
              <q-input type="number" v-model.number="editedItem.payment" label="Payment Day"></q-input>
              <q-input type="number" v-model.number="editedItem.minuslimit" label="Minus Limit"></q-input>
              <q-input type="number" v-model.number="editedItem.pluslimit" label="Plus Limit"></q-input>
            </div>
          </q-card-section>
          <q-card-actions align="center">
            <q-btn
              flat
              v-if="editedItem.id"
              label="Delete"
              color="negative"
              v-close-popup
              @click="dialogDeleteBox"
            ></q-btn>
          </q-card-actions>
          <q-card-actions align="right">
            <q-btn flat label="Cancel" color="primary" v-close-popup></q-btn>

            <q-btn
              flat
              v-if="editedItem.id"
              label="Update"
              color="primary"
              v-close-popup
              @click="updateBox"
            ></q-btn>
            <q-btn flat v-else label="Add" color="primary" v-close-popup @click="dialogAddBox"></q-btn>
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

const tab = ref("incomes");
const show_dialog = ref(false);
const columns = [
  {
    name: "name",
    align: "center",
    label: "Name",
    field: "name",
    sortable: true,
  },
  {
    name: "settlement",
    align: "center",
    label: "Settlement Day",
    field: "settlement",
    sortable: true,
  },
  {
    name: "payment",
    align: "center",
    label: "Payment Day",
    field: "payment",
    sortable: true,
  },
  {
    name: "minuslimit",
    align: "center",
    label: "Minus Limit",
    field: "minuslimit",
    sortable: true,
  },
  {
    name: "pluslimit",
    align: "center",
    label: "Plus Limit",
    field: "pluslimit",
    sortable: true,
  },
];
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
  getBoxData();
}
onMounted(() => {
  getBoxData();
});
</script>