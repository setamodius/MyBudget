const express = require('express');
const path = require('path');
require('dotenv').config();
const app = express();
const port = process.env.API_PORT || 5000;
const router = express.Router()
var cors = require('cors');
app.use(express.json());
app.use(cors());

app.listen(port, () => {
  console.log(`Budget API running on port ${port}.`);
});

const dbapi = require('./dbapi');
dbapi.seedDatabase();
router.post('/create', dbapi.formatdb);

router.get('/incomes', dbapi.getIncomes);
router.post('/incomes', dbapi.addIncome);
router.put('/incomes/:id', dbapi.updateIncome);
router.delete('/incomes/:id', dbapi.deleteIncome);
router.get('/incomes/:id/reports', dbapi.getIncomeReport);

router.get('/creditcards', dbapi.getCreditCards);
router.post('/creditcards', dbapi.addCreditCard);
router.put('/creditcards/:id', dbapi.updateCreditCard);
router.delete('/creditcards/:id', dbapi.deleteCreditCard);
router.get('/creditcards/reports', dbapi.getAllCreditCardReport);
router.get('/creditcards/:id/reports', dbapi.getCreditCardReport);
router.get('/creditcards/:id/transactions', dbapi.getCreditCardMonthlyTransactions);

router.get('/expensetypes', dbapi.getExpenseTypes);
router.post('/expensetypes', dbapi.addExpenseType);
router.put('/expensetypes/:id', dbapi.updateExpenseType);
router.delete('/expensetypes/:id', dbapi.deleteExpenseType);
router.get('/expensetypes/reports', dbapi.getAllExpenseReport);
router.get('/expensetypes/monthly-breakdown', dbapi.getMonthlyExpenseBreakdown);
router.get('/expensetypes/:id/reports', dbapi.getExpenseReport);

router.get('/boxes', dbapi.getAllBoxes)

router.get('/transactions', dbapi.gettransactions);
router.post('/transactions', dbapi.addtransaction);
router.post('/incomes/transactions', dbapi.addincometransaction);
router.put('/transactions/:id', dbapi.updatetransaction);
router.delete('/transactions/:id', dbapi.deletetransaction);

router.get("/summaries", dbapi.getSummaries);

router.get('/boxtypes', dbapi.getBoxTypes);

router.get('/storages', dbapi.getStorages);
router.post('/storages', dbapi.addStorage);
router.put('/storages/:id', dbapi.updateStorage);
router.delete('/storages/:id', dbapi.deleteStorage);
router.get('/storages/reports', dbapi.getAllStorageReport);
router.get('/storages/:id/reports', dbapi.getStorageReport);

router.get('/investments', dbapi.getInvestments);
router.post('/investments', dbapi.addInvestment);
router.put('/investments/:id', dbapi.updateInvestment);
router.delete('/investments/:id', dbapi.deleteInvestment);
router.get('/investments/reports', dbapi.getAllInvestmentReport);
router.get('/investments/:id/reports', dbapi.getInvestmentReport);

router.get('/generators', dbapi.getGenerators);
router.get('/destroyers', dbapi.getDestroyers);
router.get('/boxdirections', dbapi.getBoxDirections);
router.get('/balances', dbapi.getbalances);
router.get('/flows', dbapi.getFlows);

router.get('/period-summary', dbapi.getPeriodSummary);

const inst = require('./installments');
router.get('/installment-plans', inst.getInstallmentPlans);
router.get('/installment-plans/scan', inst.scanInstallments);
router.post('/installment-plans/resolve', inst.resolveInstallments);
router.get('/installment-plans/:id', inst.getInstallmentPlan);
router.post('/installment-plans', inst.createInstallmentPlan);
router.put('/installment-plans/:id', inst.updateInstallmentPlan);
router.delete('/installment-plans/:id', inst.deleteInstallmentPlan);
router.post('/installment-plans/:id/link', inst.linkToPlan);
router.post('/installment-plans/:id/fill', inst.fillPlanBudget);
router.post('/transactions/:id/installmentize', inst.installmentizeTransaction);

app.use('/api/v1', router);

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});
