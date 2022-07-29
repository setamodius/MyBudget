<template>
  <div class="q-ma-sm">
    <div v-for="(value, name) in modelValue" :key="name" class="row q-my-sm">
      <div class="col-4">{{name}}</div>
      <q-input dense standout v-model="modelValue[name]" class="q-ml-sm col" label="Value" />
      <q-btn
        dense
        flat
        color="red"
        class="q-ml-sm col-auto"
        icon="delete"
        size="md"
        @click="deleteProperty(name)"
      ></q-btn>
    </div>
    <div class="row">
      <q-input dense outlined v-model="newname" class="col-4" label="Key" />
      <q-input dense outlined v-model="newvalue" class="q-ml-sm col" label="Value" />
      <q-btn
        dense
        flat
        color="primary"
        class="q-ml-sm col-auto"
        icon="add"
        size="md"
        @click="addProperty"
      ></q-btn>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, defineProps, defineEmits } from "vue";

import { useQuasar } from "quasar";

const props = defineProps({
  modelValue: Object,
});

const $q = useQuasar();

function deleteProperty(name) {
  console.log(props.modelValue);
  delete props.modelValue[name];
}

const emit = defineEmits(["update:modelValue"]);

const newname = ref("");
const newvalue = ref("");

function addProperty() {
  if (props.modelValue === undefined || props.modelValue === null) {
    let newmodel = {};
    newmodel[newname.value] = newvalue.value;
    emit("update:modelValue", newmodel);
  } else {
    props.modelValue[newname.value] = newvalue.value;
  }
  newname.value = "";
  newvalue.value = "";
}

onMounted(() => {});
</script>

<style lang="sass" scoped>
.row > div
    padding: 10px 05px
    background: rgba(86,61,124,.15)
</style>