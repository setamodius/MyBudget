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
  let start = request.query.start;
  let end = request.query.end;
  var enddate = new Date();
  var startdate = new Date();
  startdate.setDate(enddate.getDate() - 100);;

  if (start !== undefined) {
    startdate = new Date(start);
  }
  if (end !== undefined) {
    enddate = new Date(end);
  }

  console.log("Start", startdate)
  console.log("End", enddate)
  if (!isNaN(fromid) && isNaN(toid)) {

    pool.query(
      `
    SELECT * FROM box_transactions WHERE frombox = $1 AND date >= $2 AND date <= $3 ORDER BY id
   
    `, [fromid, start, enddate], (error, results) => {
      if (error) {
        console.log(error);
        response.status(404).send(`Get transaction error.`);
      }
      response.status(200).json(results.rows);
    });
  }
  else if (isNaN(fromid) && !isNaN(toid)) {

    pool.query(
      `
    SELECT * FROM box_transactions WHERE tobox = $1 AND date >= $2 AND date <= $3 ORDER BY id
   
    `, [toid, start, enddate], (error, results) => {
      if (error) {
        console.log(error);
        response.status(404).send(`Get transaction error.`);
      }
      response.status(200).json(results.rows);
    });
  }
  else if (!isNaN(fromid) && !isNaN(toid)) {
    pool.query(
      `
    SELECT * FROM box_transactions WHERE frombox = $1 AND tobox = $2 AND date >= $3 AND date <= $4 ORDER BY id
   
    `, [fromid, toid, start, enddate], (error, results) => {
      if (error) {
        console.log(error);
        response.status(404).send(`Get transaction error.`);
      }
      response.status(200).json(results.rows);
    });
  }
  else {

    pool.query(
      `
    SELECT * FROM box_transactions WHERE date >= $1 AND date <= $2 ORDER BY id
   
    `, [start, enddate], (error, results) => {
      if (error) {
        console.log(error);
        response.status(404).send(`Get transaction error.`);
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
    SELECT * ,(cte3.income-cte3.expense) as balance, sum(cte3.income-cte3.expense) OVER ( ORDER BY month ) total_balance  FROM cte3 ORDER BY month`,
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
const getAllCreditCardReport = async (request, response) => {


  pool.query(
    `WITH cte AS ( SELECT date_trunc('month', DATE) AS month ,coalesce(sum(amount), 0.00) AS income FROM box_transactions WHERE tobox IN (SELECT ID FROM boxes where boxtypeid = 2) GROUP BY month ORDER BY month ) ,
     cte2 AS ( SELECT date_trunc('month', DATE) AS month ,coalesce(sum(amount), 0.00) AS expense FROM box_transactions WHERE frombox IN (SELECT ID FROM boxes where boxtypeid = 2) GROUP BY month ORDER BY month ) ,
     cte3 AS ( SELECT coalesce(cte.month, cte2.month) AS month ,coalesce(cte.income, 0.00) AS income ,coalesce(cte2.expense, 0.00) AS expense FROM cte FULL JOIN cte2 ON cte.month = cte2.month ORDER BY month ), 
     cte4 AS ( SELECT *,coalesce(LAG(expense ,1) OVER (ORDER BY month),0.00) pre_expense  from cte3),
     cte5 AS ( SELECT *, (cte4.income - cte4.pre_expense) as dept, sum(cte4.income-cte4.pre_expense) OVER ( ORDER BY month ) total_dept FROM cte4 ORDER BY month)
     SELECT month,income,expense,dept,total_dept from cte5`,

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

const getAllExpenseReport = async (request, response) => {
  const id = parseInt(request.params.id);

  pool.query(
    `WITH cte AS ( SELECT date_trunc('month', DATE) AS month ,coalesce(sum(amount), 0) AS income FROM box_transactions WHERE tobox IN (SELECT ID FROM boxes where boxtypeid = 3) GROUP BY month ORDER BY month ) ,
    cte2 AS ( SELECT date_trunc('month', DATE) AS month ,coalesce(sum(amount), 0) AS planned FROM box_transactions WHERE frombox IN (SELECT ID FROM boxes where boxtypeid = 3) GROUP BY month ORDER BY month ) ,
    cte3 AS ( SELECT coalesce(cte.month, cte2.month) AS month ,coalesce(cte.income, 0) AS income ,coalesce(cte2.planned, 0) AS planned FROM cte FULL JOIN cte2 ON cte.month = cte2.month ORDER BY month ) 
    SELECT * ,(cte3.income-cte3.planned) as dept, sum(cte3.income-cte3.planned) OVER ( ORDER BY month ) total_dept  FROM cte3 ORDER BY month`,

    (error, results) => {
      if (error) {
        console.log(error);
        response.status(400).send(`Income report error.`);
      }
      response.status(200).json(results.rows);
    }
  );
};

const getSummaries = async (request, response) => {


  pool.query(
    `WITH incomes
AS (
	SELECT date_trunc('month', DATE) AS month
		,coalesce(sum(amount), 0.00) AS income
	FROM box_transactions
	WHERE tobox = 9
	GROUP BY month
	ORDER BY month
	)
	,ccincomes
AS (
	SELECT date_trunc('month', DATE) AS month
		,coalesce(sum(amount), 0.00) AS cc_income
	FROM box_transactions
	WHERE tobox IN (
			SELECT ID
			FROM boxes
			WHERE boxtypeid = 2
			)
	GROUP BY month
	ORDER BY month
	)
	,ccexpenses
AS (
	SELECT date_trunc('month', DATE) AS month
		,coalesce(sum(amount), 0.00) AS cc_expense
	FROM box_transactions
	WHERE frombox IN (
			SELECT ID
			FROM boxes
			WHERE boxtypeid = 2
			)
	GROUP BY month
	ORDER BY month
	)
	,oincomes
AS (
	SELECT date_trunc('month', DATE) AS month
		,coalesce(sum(amount), 0.00) AS o_income
	FROM box_transactions
	WHERE tobox IN (
			SELECT ID
			FROM boxes
			WHERE boxtypeid = 3
			)
		AND frombox = 9
	GROUP BY month
	ORDER BY month
	)
	,oexpenses
AS (
	SELECT date_trunc('month', DATE) AS month
		,coalesce(sum(amount), 0.00) AS o_expense
	FROM box_transactions
	WHERE frombox IN (
			SELECT ID
			FROM boxes
			WHERE boxtypeid = 3
			)
	GROUP BY month
	ORDER BY month
	)
	,totalcc
AS (
	SELECT coalesce(ccincomes.month, ccexpenses.month) AS month
		,cc_income
		,cc_expense
	FROM ccincomes
	FULL JOIN ccexpenses ON ccincomes.month = ccexpenses.month
	ORDER BY month
	)
	,totalo
AS (
	SELECT coalesce(oincomes.month, oexpenses.month) AS month
		,o_income
		,o_expense
	FROM oincomes
	FULL JOIN oexpenses ON oincomes.month = oexpenses.month
	ORDER BY month
	)
	,totalcco
AS (
	SELECT coalesce(totalcc.month, totalo.month) AS month
		,cc_income
		,cc_expense
		,o_income
		,o_expense
	FROM totalcc
	FULL JOIN totalo ON totalcc.month = totalo.month
	ORDER BY month
	)
	,total
AS (
	SELECT coalesce(totalcco.month, incomes.month) AS month
		,coalesce(income, 0.00) AS income
		,coalesce(cc_income, 0.00) AS cc_income
		,coalesce(cc_expense, 0.00) AS cc_expense
		,coalesce(o_income, 0.00) AS o_income
		,coalesce(o_expense, 0.00) AS o_expense
	FROM totalcco
	FULL JOIN incomes ON totalcco.month = incomes.month
	ORDER BY month
	)
	,totallag
AS (
	SELECT *
		,coalesce(LAG(cc_expense, 1) OVER (
				ORDER BY month
				), 0.00) pre_expense
	FROM total
	)
SELECT month
	,income AS t_income
	,pre_expense AS t_creditcard_expense
	,o_income AS t_direct_expense
	,(pre_expense + o_income ) AS t_expense
	,(income - (pre_expense + o_income )) AS balance
FROM totallag`,

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
  getAllCreditCardReport,
  getExpenseReport,
  getAllExpenseReport,
  getSummaries
};

