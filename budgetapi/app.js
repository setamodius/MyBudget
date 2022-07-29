const express = require('express');
const app = express();
const port = 5000;
const router = express.Router()
const oldrouter = express.Router()
var cors = require('cors');
app.use(express.json());
app.use(cors());

app.listen(port, () => {
  console.log(`Budget API running on port ${port}.`);
});

const api = require('./api');

app.get('/create/', api.createtables);

router.get('/creditcard/', api.getCreditCards);
router.post('/creditcard/', api.addCreditCards);
router.delete('/creditcard/:id', api.deleteCreditCards);
router.put('/creditcard/:id', api.updateCreditCards);

router.get('/creditcard/:bankid/transactions/', api.getTransactions);
router.post('/creditcard/:bankid/transactions/', api.addTransactions);
router.delete('/creditcard/:bankid/transactions/:id', api.deleteTransactions);
router.put('/creditcard/:bankid/transactions/:id', api.updateTransactions);

router.get('/creditcard/:bankid/summary/', api.getcreaditcardsummary);
router.get('/creditcard/summary/', api.getallcreaditcardsummary);

router.get('/expenses/', api.getExpenseType);
router.post('/expenses/', api.addExpenseType);
router.delete('/expenses/:id', api.deleteExpenseType);
router.put('/expenses/:id', api.updateExpenseType);

router.get('/expenses/:typeid/transactions/', api.getExpenseTransactions);
router.post('/expenses/:typeid/transactions/', api.addExpenseTransactions);
router.delete('/expenses/:typeid/transactions/:id', api.deleteExpenseTransactions);
router.put('/expenses/:typeid/transactions/:id', api.updateExpenseTransactions);

router.get('/expenses/:typeid/summary/', api.getexpensesummary);
router.get('/expenses/summary/', api.getallexpensesummary);

app.use('/api/v1', oldrouter);

const dbapi = require('./dbapi');
router.post('/create', dbapi.formatdb);

router.get('/incomes', dbapi.getIncomes);
router.post('/incomes', dbapi.addIncome);
router.put('/incomes/:id', dbapi.updateIncome);
router.delete('/incomes/:id', dbapi.deleteIncome);
router.get('/incomes/:id/reports', dbapi.getIncomeReport);


router.get('/creditcards', dbapi.getCreditCards);
router.post('/creditcards', dbapi.addCreditCard);
router.put('/creditcards/:id', dbapi.updateCreditCard);
router.put('/creditcards/:id', dbapi.updateCreditCard);
router.get('/creditcards/:id/reports', dbapi.getCreditCardReport);

router.get('/expensetypes', dbapi.getExpenseTypes);
router.post('/expensetypes', dbapi.addExpenseType);
router.put('/expensetypes/:id', dbapi.updateExpenseType);
router.delete('/expensetypes/:id', dbapi.deleteExpenseType);
router.get('/expensetypes/:id/reports', dbapi.getExpenseReport);

router.get('/boxes', dbapi.getAllBoxes)

router.get('/transactions', dbapi.gettransactions);
router.post('/transactions', dbapi.addtransaction);
router.put('/transactions/:id', dbapi.updatetransaction);
router.delete('/transactions/:id', dbapi.deletetransaction);

app.use('/api/v1', router);

