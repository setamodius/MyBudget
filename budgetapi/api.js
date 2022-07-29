const { Pool, types } = require('pg');
require('dotenv').config()

var moment = require('moment');

types.setTypeParser(1082, (str) => str);
const pool = new Pool({
  user: process.env.USER,
  host: process.env.HOST,
  database: process.env.DATABASE,
  password: process.env.PASSWORD,
  port: process.env.PORT,
});

const createtables = async (request, response) => {
  pool.query(
    `
    DROP TABLE IF EXISTS expenses;
    DROP TABLE IF EXISTS expenses_type;

    CREATE TABLE "expenses_type" (
    "id" serial NOT NULL, 
    "name" varchar NOT NULL,
	  CONSTRAINT expenses_type_pk PRIMARY KEY ("id")
    ) WITH (
        OIDS=FALSE
    );    
    CREATE TABLE "expenses" (
    "id" serial NOT NULL, 
    "typeid" integer REFERENCES expenses_type (id) MATCH FULL ON DELETE CASCADE ,
    "date" date NOT NULL,
    "installments" integer ,
    "description" varchar NOT NULL,
    "amount" money,	
    "paid" money,	
    
	  CONSTRAINT expenses_pk PRIMARY KEY ("id")
    ) WITH (
        OIDS=FALSE
    );    
    `,
    (error, results) => {
      console.log(error);
      response.status(200).json(results);
    }
  );
};

const getCreditCards = async (request, response) => {
  pool.query(`SELECT * FROM creditcard_bank ORDER BY id`, (error, results) => {
    if (error) {
      console.log(error);
      response.status(404).send(`Get credit card bank error.`);
    }
    console.log(results.rows);
    response.status(200).json(results.rows);
  });
};

const addCreditCards = async (request, response) => {
  const { name } = request.body;

  pool.query(
    'INSERT INTO creditcard_bank (name) VALUES ($1)',
    [name],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`CreditCards add error.`);
      }

      response.status(201).send(`CreditCards added successfully.`);
    }
  );
};

const updateCreditCards = (request, response) => {
  const id = parseInt(request.params.id);
  const { name } = request.body;

  pool.query(
    'UPDATE creditcard_bank SET name = $1 WHERE id = $2',
    [name, id],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Credit card modify error.`);
      }
      response.status(200).send(`Credit card modified with ID: ${id}`);
    }
  );
};

const deleteCreditCards = (request, response) => {
  const id = parseInt(request.params.id);

  pool.query(
    'DELETE FROM creditcard_bank WHERE id = $1',
    [id],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Credit card delete error.`);
      }
      response.status(200).send(`Credit card deleted with ID: ${id}`);
    }
  );
};

const getTransactions = async (request, response) => {
  const bankid = parseInt(request.params.bankid);
  pool.query(
    `SELECT * FROM creditcard WHERE bankid = $1 ORDER BY id `,
    [bankid],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(404).send(`Get item error.`);
      }
      response.status(200).json(results.rows);
    }
  );
};

const addTransactions = async (request, response) => {
  const bankid = parseInt(request.params.bankid);
  const { date, description, installments, amount, paid } = request.body;
  console.log(bankid);
  pool.query(
    'INSERT INTO creditcard (date, description,installments,amount,paid,bankid) VALUES ($1, $2, $3, $4,$5, $6)',
    [date, description, installments, amount, paid, bankid],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Item add error.`);
      }

      response.status(201).send(`Item added successfully.`);
    }
  );
};

const updateTransactions = (request, response) => {
  const bankid = parseInt(request.params.bankid);
  const id = parseInt(request.params.id);
  const { date, description, installments, amount, paid } = request.body;

  pool.query(
    'UPDATE creditcard SET date = $1, description = $2 ,installments = $3, amount = $4, paid = $5 WHERE id = $6 AND bankid = $7',
    [date, description, installments, amount, paid, id, bankid],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Item modify error.`);
      }
      response.status(200).send(`Item modified with ID: ${id}`);
    }
  );
};

const deleteTransactions = (request, response) => {
  const bankid = parseInt(request.params.bankid);
  const id = parseInt(request.params.id);

  pool.query(
    'DELETE FROM creditcard WHERE id = $1 AND bankid = $2',
    [id, bankid],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Item delete error.`);
      }
      response.status(200).send(`User deleted with ID: ${id}`);
    }
  );
};

const getcreaditcardsummary = (request, response) => {
  const bankid = parseInt(request.params.bankid);
  let start = request.query.start;
  let end = request.query.end;
  if (start === undefined || end === undefined) {
    response.status(404).send(`Parameter error.`);
  }
  var startdate = new Date(start);
  let enddate = new Date(end);

  pool.query(
    `WITH cte AS (SELECT date_trunc('month', date) AS month,coalesce(sum(amount), '$0') AS dept, coalesce(sum(paid), '$0') AS payload FROM creditcard WHERE (bankid = $1) GROUP BY month ORDER BY month),
        cte2 AS (select *, SUM(dept) OVER (ORDER BY month) cum_dept, SUM(payload) OVER (ORDER BY month) cum_payload from cte),
        cte3 AS (select *, LAG(cum_dept ,1) OVER (ORDER BY month) pre_cum_dept  FROM cte2)
      SELECT month, dept, cum_dept, payload,cum_payload,(pre_cum_dept - cum_payload ) as tobepaid FROM cte3`,
    [bankid],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(404).send(`Get item error.`);
      }
      response.status(200).json(results.rows);
    }
  );
};

const getallcreaditcardsummary = (request, response) => {
  const bankid = parseInt(request.params.bankid);
  let start = request.query.start;
  let end = request.query.end;
  if (start === undefined || end === undefined) {
    response.status(404).send(`Parameter error.`);
  }
  var startdate = new Date(start);
  let enddate = new Date(end);

  pool.query(
    `WITH cte AS (SELECT date_trunc('month', date) AS month,coalesce(sum(amount), '$0') AS dept, coalesce(sum(paid), '$0') AS payload FROM creditcard GROUP BY month ORDER BY month),
        cte2 AS (select *, SUM(dept) OVER (ORDER BY month) cum_dept, SUM(payload) OVER (ORDER BY month) cum_payload from cte),
        cte3 AS (select *, LAG(cum_dept ,1) OVER (ORDER BY month) pre_cum_dept  FROM cte2)
      SELECT month, dept, cum_dept, payload,cum_payload,(pre_cum_dept - cum_payload ) as tobepaid FROM cte3`,
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(404).send(`Get item error.`);
      }
      response.status(200).json(results.rows);
    }
  );
};

const getExpenseType = async (request, response) => {
  pool.query(`SELECT * FROM expenses_type ORDER BY id`, (error, results) => {
    if (error) {
      console.log(error);
      response.status(404).send(`Get expense type error.`);
    }
    console.log(results.rows);
    response.status(200).json(results.rows);
  });
};

const addExpenseType = async (request, response) => {
  const { name } = request.body;

  pool.query(
    'INSERT INTO expenses_type (name) VALUES ($1)',
    [name],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Expense type add error.`);
      }

      response.status(201).send(`Expense type added successfully.`);
    }
  );
};

const updateExpenseType = (request, response) => {
  const id = parseInt(request.params.id);
  const { name } = request.body;

  pool.query(
    'UPDATE expenses_type SET name = $1 WHERE id = $2',
    [name, id],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Expense type modify error.`);
      }
      response.status(200).send(`Expense type modified with ID: ${id}`);
    }
  );
};

const deleteExpenseType = (request, response) => {
  const id = parseInt(request.params.id);

  pool.query(
    'DELETE FROM expenses_type WHERE id = $1',
    [id],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Expense type delete error.`);
      }
      response.status(200).send(`Expense type deleted with ID: ${id}`);
    }
  );
};

const getExpenseTransactions = async (request, response) => {
  const typeid = parseInt(request.params.typeid);
  pool.query(
    `SELECT * FROM expenses WHERE typeid = $1 ORDER BY id `,
    [typeid],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(404).send(`Get item error.`);
      }
      response.status(200).json(results.rows);
    }
  );
};

const addExpenseTransactions = async (request, response) => {
  const typeid = parseInt(request.params.typeid);
  const { date, description, installments, amount, paid } = request.body;
  console.log(request.body);
  pool.query(
    'INSERT INTO expenses (date, description,installments,amount,paid,typeid) VALUES ($1, $2, $3, $4,$5, $6)',
    [date, description, installments, amount, paid, typeid],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Item add error.`);
      }

      response.status(201).send(`Item added successfully.`);
    }
  );
};

const updateExpenseTransactions = (request, response) => {
  const typeid = parseInt(request.params.typeid);
  const id = parseInt(request.params.id);
  const { date, description, installments, amount, paid } = request.body;

  pool.query(
    'UPDATE expenses SET date = $1, description = $2 ,installments = $3, amount = $4, paid = $5 WHERE id = $6 AND typeid = $7',
    [date, description, installments, amount, paid, id, typeid],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Item modify error.`);
      }
      response.status(200).send(`Item modified with ID: ${id}`);
    }
  );
};

const deleteExpenseTransactions = (request, response) => {
  const typeid = parseInt(request.params.typeid);
  const id = parseInt(request.params.id);

  pool.query(
    'DELETE FROM expenses WHERE id = $1 AND typeid = $2',
    [id, typeid],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Item delete error.`);
      }
      response.status(200).send(`User deleted with ID: ${id}`);
    }
  );
};

const getexpensesummary = (request, response) => {
  const typeid = parseInt(request.params.typeid);

  if (start === undefined || end === undefined) {
    response.status(404).send(`Parameter error.`);
  }
  var startdate = new Date(start);
  let enddate = new Date(end);

  pool.query(
    `WITH cte AS (SELECT date_trunc('month', date) AS month,coalesce(sum(amount), '$0') AS dept, coalesce(sum(paid), '$0') AS payload FROM expenses WHERE typeid = $1 GROUP BY month ORDER BY month),
    cte2 AS (select *, SUM(dept) OVER (ORDER BY month) cum_dept, SUM(payload) OVER (ORDER BY month) cum_payload from cte)
    SELECT month, dept, cum_dept, payload,cum_payload,(cum_dept- cum_payload ) as tobepaid FROM cte2`,
    [typeid],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(404).send(`Get item error.`);
      }
      response.status(200).json(results.rows);
    }
  );
};

const getallexpensesummary = (request, response) => {
  const bankid = parseInt(request.params.bankid);
  let start = request.query.start;
  let end = request.query.end;
  if (start === undefined || end === undefined) {
    response.status(404).send(`Parameter error.`);
  }
  var startdate = new Date(start);
  let enddate = new Date(end);

  pool.query(
    `WITH cte AS (SELECT date_trunc('month', date) AS month,coalesce(sum(amount), '$0') AS dept, coalesce(sum(paid), '$0') AS payload FROM expenses GROUP BY month ORDER BY month),
    cte2 AS (select *, SUM(dept) OVER (ORDER BY month) cum_dept, SUM(payload) OVER (ORDER BY month) cum_payload from cte)
    SELECT month, dept, cum_dept, payload,cum_payload,(cum_dept- cum_payload ) as tobepaid FROM cte2`,
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(404).send(`Get item error.`);
      }
      response.status(200).json(results.rows);
    }
  );
};

module.exports = {
  getCreditCards,
  addCreditCards,
  updateCreditCards,
  deleteCreditCards,
  createtables,
  getTransactions,
  addTransactions,
  updateTransactions,
  deleteTransactions,
  getcreaditcardsummary,
  getallcreaditcardsummary,
  getExpenseType,
  addExpenseType,
  updateExpenseType,
  deleteExpenseType,
  getExpenseTransactions,
  addExpenseTransactions,
  updateExpenseTransactions,
  deleteExpenseTransactions,
  getexpensesummary,
  getallexpensesummary,
};
