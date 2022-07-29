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

const formatdb = async (request, response) => {
  pool.query(
    `
    DROP TABLE IF EXISTS box_transactions;
    DROP TABLE IF EXISTS boxes;
    DROP TABLE IF EXISTS box_types;

    CREATE TABLE "box_types" (
    "id" serial NOT NULL, 
    "name" varchar NOT NULL,
	  CONSTRAINT box_types_pk PRIMARY KEY ("id")
    ) WITH (
        OIDS=FALSE
    );

    INSERT INTO box_types (name) VALUES ('Income');
    INSERT INTO box_types (name) VALUES ('CreditCard');
    INSERT INTO box_types (name) VALUES ('ExpenseType');

    CREATE TABLE "boxes" (
    "id" serial NOT NULL, 
    "boxtypeid" integer REFERENCES box_types (id) MATCH FULL ON DELETE CASCADE ,
    "name" varchar NOT NULL,
    "settlement" integer,
    "payment" integer,
    "minuslimit" numeric(12,2),
    "pluslimit" numeric(12,2),    
	CONSTRAINT boxes_pk PRIMARY KEY ("id")
    ) WITH (
        OIDS=FALSE
    );  
    
    INSERT INTO boxes (boxtypeid,name,settlement,payment,minuslimit,pluslimit) VALUES (1,'Void', 0,0,-1,-1);

    CREATE TABLE "box_transactions" (
    "id" serial NOT NULL, 
    "date" date NOT NULL,
    "frombox" integer REFERENCES boxes (id) MATCH FULL ON UPDATE CASCADE ,
    "tobox" integer REFERENCES boxes (id) MATCH FULL ON UPDATE CASCADE ,
    "description" varchar,    
    "amount" numeric(12,2),
    info json,   
	CONSTRAINT box_transactions_pk PRIMARY KEY ("id")
    ) WITH (
        OIDS=FALSE
    );  
    `,
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(404).send(error);
      }
      console.log(error);
      response.status(200).json(results);
    }
  );
};

const getIncomes = async (request, response) => {
  await getboxfunction(1, request, response)
};

const getCreditCards = async (request, response) => {
  await getboxfunction(2, request, response)
};

const getExpenseTypes = async (request, response) => {
  await getboxfunction(3, request, response)
};

const addIncome = async (request, response) => {
  await addboxfunction(1, request, response)
};

const addCreditCard = async (request, response) => {
  await addboxfunction(2, request, response)
};

const addExpenseType = async (request, response) => {
  await addboxfunction(3, request, response)
};

const updateIncome = async (request, response) => {
  await updateboxfunction(request, response)
};

const updateCreditCard = async (request, response) => {
  await updateboxfunction(request, response)
};

const updateExpenseType = async (request, response) => {
  await updateboxfunction(request, response)
};

const deleteIncome = async (request, response) => {
  await deleteboxfunction(request, response)
};

const deleteCreditCard = async (request, response) => {
  await deleteboxfunction(request, response)
};

const deleteExpenseType = async (request, response) => {
  await deleteboxfunction(request, response)
};

const getAllBoxes = async (request, response) => {
  await getboxfunction(0, request, response)
};

const getboxfunction = async (typeid, request, response) => {
  let query = ""
  if (typeid === 0) {
    query = "SELECT * FROM boxes WHERE boxtypeid <> $1 ORDER BY id"
  }
  else {
    query = "SELECT * FROM boxes WHERE boxtypeid = $1 ORDER BY id"
  }
  pool.query(query, [typeid], (error, results) => {
    if (error) {
      console.log(error);
      response.status(404).send(`Get box error.`);
    }
    response.status(200).json(results.rows);
  });
}

const addboxfunction = async (typeid, request, response) => {
  const { name, settlement, payment, minuslimit, pluslimit } = request.body;

  pool.query(
    'INSERT INTO boxes (boxtypeid,name,settlement,payment,minuslimit,pluslimit) VALUES ($1,$2,$3,$4,$5,$6)',
    [typeid, name, settlement, payment, minuslimit, pluslimit],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Box add error.`);
      }
      response.status(201).send(`Box added successfully.`);
    }
  );
};

const updateboxfunction = (request, response) => {
  const id = parseInt(request.params.id);
  const { name, settlement, payment, minuslimit, pluslimit } = request.body;

  pool.query(
    'UPDATE boxes SET name = $2,settlement = $3, payment = $4 ,minuslimit = $5, pluslimit = $6 WHERE id = $1',
    [id, name, settlement, payment, minuslimit, pluslimit],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Box modify error.`);
      }
      response.status(200).send(`Box modified with ID: ${id}`);
    }
  );
};

const deleteboxfunction = (request, response) => {
  const id = parseInt(request.params.id);

  pool.query(
    'DELETE FROM boxes WHERE id = $1',
    [id],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Box delete error.`);
      }
      response.status(200).send(`Box deleted with ID: ${id}`);
    }
  );
};

const gettransactions = async (request, response) => {
  let fromid = parseInt(request.query.from);
  let toid = parseInt(request.query.to);
  if (!isNaN(fromid) && isNaN(toid)) {

    pool.query(
      `
    SELECT * FROM box_transactions WHERE frombox = $1 ORDER BY id
   
    `, [fromid], (error, results) => {
      if (error) {
        console.log(error);
        response.status(404).send(`Get box error.`);
      }
      response.status(200).json(results.rows);
    });
  }
  else if (isNaN(fromid) && !isNaN(toid)) {

    pool.query(
      `
    SELECT * FROM box_transactions WHERE tobox = $1 ORDER BY id
   
    `, [toid], (error, results) => {
      if (error) {
        console.log(error);
        response.status(404).send(`Get box error.`);
      }
      response.status(200).json(results.rows);
    });
  }
  else if (!isNaN(fromid) && !isNaN(toid)) {
    pool.query(
      `
    SELECT * FROM box_transactions WHERE frombox = $1 AND tobox = $2 ORDER BY id
   
    `, [fromid, toid], (error, results) => {
      if (error) {
        console.log(error);
        response.status(404).send(`Get box error.`);
      }
      response.status(200).json(results.rows);
    });
  }
  else {

    pool.query(
      `
    SELECT * FROM box_transactions ORDER BY id
   
    `, (error, results) => {
      if (error) {
        console.log(error);
        response.status(404).send(`Get box error.`);
      }
      response.status(200).json(results.rows);
    });
  }
}

const addtransaction = async (request, response) => {
  const { date, frombox, tobox, description, amount, info } = request.body;
  pool.query(
    'INSERT INTO box_transactions (date,frombox,tobox,description, amount,info) VALUES ($1,$2,$3,$4,$5,$6)',
    [date, frombox, tobox, description, amount, info],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Transaction add error.`);
      }
      response.status(201).send(`Transaction added successfully.`);
    }
  );
};

const updatetransaction = (request, response) => {
  const id = parseInt(request.params.id);
  const { date, frombox, tobox, description, amount, info } = request.body;

  pool.query(
    'UPDATE box_transactions SET date = $2,frombox = $3, tobox = $4 ,description = $5, amount = $6, info = $7 WHERE id = $1',
    [id, date, frombox, tobox, description, amount, info],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Transaction modify error.`);
      }
      response.status(200).send(`Transaction modified with ID: ${id}`);
    }
  );
};

const deletetransaction = (request, response) => {
  const id = parseInt(request.params.id);

  pool.query(
    'DELETE FROM box_transactions WHERE id = $1',
    [id],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Transaction delete error.`);
      }
      response.status(200).send(`Transaction deleted with ID: ${id}`);
    }
  );
};

const getIncomeReport = async (request, response) => {
  const id = parseInt(request.params.id);

  pool.query(
    `WITH cte AS ( SELECT date_trunc('month', DATE) AS month ,coalesce(sum(amount), 0) AS income FROM box_transactions WHERE tobox = $1 GROUP BY month ORDER BY month ) ,
    cte2 AS ( SELECT date_trunc('month', DATE) AS month ,coalesce(sum(amount), 0) AS expense FROM box_transactions WHERE frombox = $1 GROUP BY month ORDER BY month ) ,
    cte3 AS ( SELECT coalesce(cte.month, cte2.month) AS month ,coalesce(cte.income, 0) AS income ,coalesce(cte2.expense, 0) AS expense FROM cte FULL JOIN cte2 ON cte.month = cte2.month ORDER BY month ) 
    SELECT * ,(cte3.income-cte3.expense) as dept, sum(cte3.income-cte3.expense) OVER ( ORDER BY month ) total_dept  FROM cte3 ORDER BY month`,
    [id],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Income report error.`);
      }
      response.status(200).json(results.rows);
    }
  );
};

const getCreditCardReport = async (request, response) => {
  const id = parseInt(request.params.id);

  pool.query(
    `WITH cte AS ( SELECT date_trunc('month', DATE) AS month ,coalesce(sum(amount), 0.00) AS income FROM box_transactions WHERE tobox = $1 GROUP BY month ORDER BY month ) ,
     cte2 AS ( SELECT date_trunc('month', DATE) AS month ,coalesce(sum(amount), 0.00) AS expense FROM box_transactions WHERE frombox = $1 GROUP BY month ORDER BY month ) ,
     cte3 AS ( SELECT coalesce(cte.month, cte2.month) AS month ,coalesce(cte.income, 0.00) AS income ,coalesce(cte2.expense, 0.00) AS expense FROM cte FULL JOIN cte2 ON cte.month = cte2.month ORDER BY month ), 
     cte4 AS ( SELECT *,coalesce(LAG(expense ,1) OVER (ORDER BY month),0.00) pre_expense  from cte3),
     cte5 AS ( SELECT *, (cte4.income - cte4.pre_expense) as dept, sum(cte4.income-cte4.pre_expense) OVER ( ORDER BY month ) total_dept FROM cte4 ORDER BY month)
     SELECT month,income,expense,dept,total_dept from cte5`,
    [id],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Income report error.`);
      }
      response.status(200).json(results.rows);
    }
  );
};

const getExpenseReport = async (request, response) => {
  const id = parseInt(request.params.id);

  pool.query(
    `WITH cte AS ( SELECT date_trunc('month', DATE) AS month ,coalesce(sum(amount), 0) AS income FROM box_transactions WHERE tobox = $1 GROUP BY month ORDER BY month ) ,
    cte2 AS ( SELECT date_trunc('month', DATE) AS month ,coalesce(sum(amount), 0) AS planned FROM box_transactions WHERE frombox = $1 GROUP BY month ORDER BY month ) ,
    cte3 AS ( SELECT coalesce(cte.month, cte2.month) AS month ,coalesce(cte.income, 0) AS income ,coalesce(cte2.planned, 0) AS planned FROM cte FULL JOIN cte2 ON cte.month = cte2.month ORDER BY month ) 
    SELECT * ,(cte3.income-cte3.planned) as dept, sum(cte3.income-cte3.planned) OVER ( ORDER BY month ) total_dept  FROM cte3 ORDER BY month`,
    [id],
    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Income report error.`);
      }
      response.status(200).json(results.rows);
    }
  );
};

module.exports = {
  formatdb,
  getIncomes,
  getCreditCards,
  getExpenseTypes,
  addIncome,
  addCreditCard,
  addExpenseType,
  updateIncome,
  updateCreditCard,
  updateExpenseType,
  deleteIncome,
  deleteCreditCard,
  deleteExpenseType,
  getAllBoxes,
  gettransactions,
  addtransaction,
  updatetransaction,
  deletetransaction,
  getIncomeReport,
  getCreditCardReport,
  getExpenseReport
};
