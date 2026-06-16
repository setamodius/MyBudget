const { Pool, types } = require('pg');
require('dotenv').config()

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
    INSERT INTO box_types (name) VALUES ('Generator');
    INSERT INTO box_types (name) VALUES ('Destroyer');
    INSERT INTO box_types (name) VALUES ('Storage');
    INSERT INTO box_types (name) VALUES ('Investment');

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
        return response.status(500).send(error);
      }
      response.status(200).json(results);
    }
  );
};

const seedDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "box_types" (
        "id" serial NOT NULL,
        "name" varchar NOT NULL,
        CONSTRAINT box_types_pk PRIMARY KEY ("id")
      );

      INSERT INTO box_types (name) SELECT 'Income'      WHERE NOT EXISTS (SELECT 1 FROM box_types WHERE name = 'Income');
      INSERT INTO box_types (name) SELECT 'CreditCard'  WHERE NOT EXISTS (SELECT 1 FROM box_types WHERE name = 'CreditCard');
      INSERT INTO box_types (name) SELECT 'ExpenseType' WHERE NOT EXISTS (SELECT 1 FROM box_types WHERE name = 'ExpenseType');
      INSERT INTO box_types (name) SELECT 'Generator'   WHERE NOT EXISTS (SELECT 1 FROM box_types WHERE name = 'Generator');
      INSERT INTO box_types (name) SELECT 'Destroyer'   WHERE NOT EXISTS (SELECT 1 FROM box_types WHERE name = 'Destroyer');
      INSERT INTO box_types (name) SELECT 'Storage'     WHERE NOT EXISTS (SELECT 1 FROM box_types WHERE name = 'Storage');
      INSERT INTO box_types (name) SELECT 'Investment'  WHERE NOT EXISTS (SELECT 1 FROM box_types WHERE name = 'Investment');

      CREATE TABLE IF NOT EXISTS "boxes" (
        "id" serial NOT NULL,
        "boxtypeid" integer REFERENCES box_types (id) ON DELETE CASCADE,
        "name" varchar NOT NULL,
        "settlement" integer,
        "payment" integer,
        "minuslimit" numeric(12,2),
        "pluslimit" numeric(12,2),
        CONSTRAINT boxes_pk PRIMARY KEY ("id")
      );

      CREATE TABLE IF NOT EXISTS "box_transactions" (
        "id" serial NOT NULL,
        "date" date NOT NULL,
        "frombox" integer REFERENCES boxes (id) ON UPDATE CASCADE,
        "tobox" integer REFERENCES boxes (id) ON UPDATE CASCADE,
        "description" varchar,
        "amount" numeric(12,2),
        "info" json,
        CONSTRAINT box_transactions_pk PRIMARY KEY ("id")
      );

      INSERT INTO boxes (boxtypeid, name, settlement, payment, minuslimit, pluslimit)
      SELECT id, 'Dış Kaynak', 0, 0, -1, -1
      FROM box_types WHERE name = 'Generator'
      AND NOT EXISTS (SELECT 1 FROM boxes b JOIN box_types bt ON b.boxtypeid = bt.id WHERE bt.name = 'Generator');

      CREATE TABLE IF NOT EXISTS "installment_plans" (
        "id" serial NOT NULL,
        "description" varchar NOT NULL,
        "expense_box_id" integer REFERENCES boxes(id) ON DELETE CASCADE,
        "payment_box_id" integer REFERENCES boxes(id) ON DELETE SET NULL,
        "start_date" date NOT NULL,
        "total_installments" integer NOT NULL,
        "amount_per_month" numeric(12,2) NOT NULL,
        "total_amount" numeric(12,2),
        CONSTRAINT installment_plans_pk PRIMARY KEY ("id")
      );

      CREATE TABLE IF NOT EXISTS "box_directions" (
        "id" serial NOT NULL,
        "fromid" integer REFERENCES box_types(id) ON DELETE CASCADE,
        "toid"   integer REFERENCES box_types(id) ON DELETE CASCADE,
        CONSTRAINT box_directions_pk PRIMARY KEY ("id")
      );

      INSERT INTO box_directions (fromid, toid)
        SELECT f.id, t.id FROM box_types f, box_types t
        WHERE f.name = 'Generator'   AND t.name = 'Income'
          AND NOT EXISTS (SELECT 1 FROM box_directions WHERE fromid = f.id AND toid = t.id);
      INSERT INTO box_directions (fromid, toid)
        SELECT f.id, t.id FROM box_types f, box_types t
        WHERE f.name = 'Income'      AND t.name = 'Storage'
          AND NOT EXISTS (SELECT 1 FROM box_directions WHERE fromid = f.id AND toid = t.id);
      INSERT INTO box_directions (fromid, toid)
        SELECT f.id, t.id FROM box_types f, box_types t
        WHERE f.name = 'Income'      AND t.name = 'Investment'
          AND NOT EXISTS (SELECT 1 FROM box_directions WHERE fromid = f.id AND toid = t.id);
      INSERT INTO box_directions (fromid, toid)
        SELECT f.id, t.id FROM box_types f, box_types t
        WHERE f.name = 'Storage'     AND t.name = 'CreditCard'
          AND NOT EXISTS (SELECT 1 FROM box_directions WHERE fromid = f.id AND toid = t.id);
      INSERT INTO box_directions (fromid, toid)
        SELECT f.id, t.id FROM box_types f, box_types t
        WHERE f.name = 'Storage'     AND t.name = 'Investment'
          AND NOT EXISTS (SELECT 1 FROM box_directions WHERE fromid = f.id AND toid = t.id);
      INSERT INTO box_directions (fromid, toid)
        SELECT f.id, t.id FROM box_types f, box_types t
        WHERE f.name = 'Storage'     AND t.name = 'ExpenseType'
          AND NOT EXISTS (SELECT 1 FROM box_directions WHERE fromid = f.id AND toid = t.id);
      INSERT INTO box_directions (fromid, toid)
        SELECT f.id, t.id FROM box_types f, box_types t
        WHERE f.name = 'Investment'  AND t.name = 'Storage'
          AND NOT EXISTS (SELECT 1 FROM box_directions WHERE fromid = f.id AND toid = t.id);
      INSERT INTO box_directions (fromid, toid)
        SELECT f.id, t.id FROM box_types f, box_types t
        WHERE f.name = 'CreditCard'  AND t.name = 'ExpenseType'
          AND NOT EXISTS (SELECT 1 FROM box_directions WHERE fromid = f.id AND toid = t.id);
      INSERT INTO box_directions (fromid, toid)
        SELECT f.id, t.id FROM box_types f, box_types t
        WHERE f.name = 'ExpenseType' AND t.name = 'Destroyer'
          AND NOT EXISTS (SELECT 1 FROM box_directions WHERE fromid = f.id AND toid = t.id);
      INSERT INTO box_directions (fromid, toid)
        SELECT f.id, t.id FROM box_types f, box_types t
        WHERE f.name = 'ExpenseType' AND t.name = 'Storage'
          AND NOT EXISTS (SELECT 1 FROM box_directions WHERE fromid = f.id AND toid = t.id);
      INSERT INTO box_directions (fromid, toid)
        SELECT f.id, t.id FROM box_types f, box_types t
        WHERE f.name = 'CreditCard'  AND t.name = 'Investment'
          AND NOT EXISTS (SELECT 1 FROM box_directions WHERE fromid = f.id AND toid = t.id);
    `);
    console.log('Database seed OK.');
  } catch (err) {
    console.error('Seed error:', err.message);
  }
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
      return response.status(404).send(`Get box error.`);
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
        return response.status(400).send(`Box add error.`);
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
        return response.status(400).send(`Box modify error.`);
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
        return response.status(400).send(`Box delete error.`);
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
  startdate.setDate(enddate.getDate() - 100);

  if (start !== undefined) {
    startdate = new Date(start);
  }
  if (end !== undefined) {
    enddate = new Date(end);
  }

  if (!isNaN(fromid) && isNaN(toid)) {
    pool.query(
      `SELECT * FROM box_transactions WHERE frombox = $1 AND date >= $2 AND date <= $3 ORDER BY id`,
      [fromid, startdate, enddate],
      (error, results) => {
        if (error) {
          console.log(error);
          return response.status(404).send(`Get transaction error.`);
        }
        response.status(200).json(results.rows);
      }
    );
  }
  else if (isNaN(fromid) && !isNaN(toid)) {
    pool.query(
      `SELECT * FROM box_transactions WHERE tobox = $1 AND date >= $2 AND date <= $3 ORDER BY id`,
      [toid, startdate, enddate],
      (error, results) => {
        if (error) {
          console.log(error);
          return response.status(404).send(`Get transaction error.`);
        }
        response.status(200).json(results.rows);
      }
    );
  }
  else if (!isNaN(fromid) && !isNaN(toid)) {
    pool.query(
      `SELECT * FROM box_transactions WHERE frombox = $1 AND tobox = $2 AND date >= $3 AND date <= $4 ORDER BY id`,
      [fromid, toid, startdate, enddate],
      (error, results) => {
        if (error) {
          console.log(error);
          return response.status(404).send(`Get transaction error.`);
        }
        response.status(200).json(results.rows);
      }
    );
  }
  else {
    pool.query(
      `SELECT * FROM box_transactions WHERE date >= $1 AND date <= $2 ORDER BY id`,
      [startdate, enddate],
      (error, results) => {
        if (error) {
          console.log(error);
          return response.status(404).send(`Get transaction error.`);
        }
        response.status(200).json(results.rows);
      }
    );
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
        return response.status(400).send(`Transaction add error.`);
      }
      response.status(201).send(`Transaction added successfully.`);
    }
  );
};

const addincometransaction = async (request, response) => {
  const { date, frombox, tobox, description, amount, info } = request.body;
  try {
    await pool.query(
      'INSERT INTO box_transactions (date,frombox,tobox,description,amount,info) VALUES ($1,$2,$3,$4,$5,$6)',
      [date, frombox, tobox, description, amount, info]
    );
    response.status(201).send('Income transaction added.');
  } catch (err) {
    console.error(err);
    response.status(500).send('Income transaction error.');
  }
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
        return response.status(400).send(`Transaction modify error.`);
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
        return response.status(400).send(`Transaction delete error.`);
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
        return response.status(400).send(`Income report error.`);
      }
      response.status(200).json(results.rows);
    }
  );
};

const getCreditCardReport = async (request, response) => {
  const id = parseInt(request.params.id);

  pool.query(
    `WITH card_info AS (
       SELECT COALESCE(settlement, 31) AS settlement FROM boxes WHERE id = $1
     ),
     expenses_by_cycle AS (
       SELECT
         date_trunc('month',
           CASE
             WHEN EXTRACT(DAY FROM bt.date) <= (SELECT settlement FROM card_info)
             THEN bt.date
             ELSE bt.date + interval '1 month'
           END
         ) AS billing_month,
         COALESCE(SUM(bt.amount), 0.00) AS expense
       FROM box_transactions bt
       WHERE bt.frombox = $1
       GROUP BY billing_month
     ),
     payments AS (
       SELECT date_trunc('month', date) AS payment_month, COALESCE(SUM(amount), 0.00) AS income
       FROM box_transactions WHERE tobox = $1
       GROUP BY payment_month
     ),
     combined AS (
       SELECT
         COALESCE(p.payment_month, e.billing_month) AS month,
         COALESCE(p.income, 0.00) AS income,
         COALESCE(e.expense, 0.00) AS expense
       FROM payments p
       FULL JOIN expenses_by_cycle e ON p.payment_month = e.billing_month
     )
     SELECT month, income, expense,
       (income - expense) AS balance,
       SUM(income - expense) OVER (ORDER BY month) AS total_balance
     FROM combined ORDER BY month`,
    [id],
    (error, results) => {
      if (error) {
        console.log(error);
        return response.status(400).send(`Credit card report error.`);
      }
      response.status(200).json(results.rows);
    }
  );
};

const getAllCreditCardReport = async (request, response) => {
  pool.query(
    `WITH expenses_by_cycle AS (
       SELECT
         date_trunc('month',
           CASE
             WHEN EXTRACT(DAY FROM bt.date) <= COALESCE(b.settlement, 31)
             THEN bt.date
             ELSE bt.date + interval '1 month'
           END
         ) AS billing_month,
         COALESCE(SUM(bt.amount), 0.00) AS expense
       FROM box_transactions bt
       JOIN boxes b ON b.id = bt.frombox
       WHERE bt.frombox IN (SELECT id FROM boxes WHERE boxtypeid = 2)
       GROUP BY billing_month
     ),
     payments AS (
       SELECT date_trunc('month', date) AS payment_month, COALESCE(SUM(amount), 0.00) AS income
       FROM box_transactions WHERE tobox IN (SELECT id FROM boxes WHERE boxtypeid = 2)
       GROUP BY payment_month
     ),
     combined AS (
       SELECT
         COALESCE(p.payment_month, e.billing_month) AS month,
         COALESCE(p.income, 0.00) AS income,
         COALESCE(e.expense, 0.00) AS expense
       FROM payments p
       FULL JOIN expenses_by_cycle e ON p.payment_month = e.billing_month
     )
     SELECT month, income, expense,
       (income - expense) AS balance,
       SUM(income - expense) OVER (ORDER BY month) AS total_balance
     FROM combined ORDER BY month`,
    (error, results) => {
      if (error) {
        console.log(error);
        return response.status(400).send(`Credit card report error.`);
      }
      response.status(200).json(results.rows);
    }
  );
};

const getExpenseReport = async (request, response) => {
  const id = parseInt(request.params.id);

  pool.query(
    `WITH incoming AS (
       SELECT
         date_trunc('month', bt.date) AS month,
         COALESCE(SUM(CASE WHEN fb.boxtypeid = 6 THEN bt.amount ELSE 0 END), 0) AS cash,
         COALESCE(SUM(CASE WHEN fb.boxtypeid = 2 AND EXTRACT(DAY FROM bt.date) <= COALESCE(fb.settlement, 31) THEN bt.amount ELSE 0 END), 0) AS cc_this_cycle,
         COALESCE(SUM(CASE WHEN fb.boxtypeid = 2 AND EXTRACT(DAY FROM bt.date) >  COALESCE(fb.settlement, 31) THEN bt.amount ELSE 0 END), 0) AS cc_next_cycle,
         COALESCE(SUM(bt.amount), 0) AS income
       FROM box_transactions bt
       JOIN boxes fb ON fb.id = bt.frombox
       WHERE bt.tobox = $1
       GROUP BY month
     ),
     refunds AS (
       SELECT
         date_trunc('month', bt.date) AS month,
         COALESCE(SUM(bt.amount), 0) AS total_refund
       FROM box_transactions bt
       JOIN boxes tb ON tb.id = bt.tobox
       WHERE bt.frombox = $1
         AND tb.boxtypeid = 6
       GROUP BY month
     ),
     outgoing AS (
       SELECT
         date_trunc('month', bt.date) AS month,
         CASE
           WHEN COUNT(*) FILTER (WHERE bt.info->>'type' = 'budget') > 0
           THEN COALESCE(SUM(bt.amount) FILTER (WHERE bt.info->>'type' = 'budget'), 0)
           ELSE COALESCE(SUM(bt.amount) FILTER (WHERE bt.info->>'type' IS DISTINCT FROM 'budget'), 0)
         END AS planned
       FROM box_transactions bt
       JOIN boxes tb ON tb.id = bt.tobox
       WHERE bt.frombox = $1
         AND tb.boxtypeid = 5
       GROUP BY month
     ),
     combined AS (
       SELECT
         COALESCE(i.month, o.month, r.month) AS month,
         COALESCE(i.cash, 0)                                        AS cash,
         COALESCE(i.cc_this_cycle, 0)                               AS cc_this_cycle,
         COALESCE(i.cc_next_cycle, 0)                               AS cc_next_cycle,
         COALESCE(i.income, 0) - COALESCE(r.total_refund, 0)       AS income,
         COALESCE(o.planned, 0)                                     AS planned
       FROM incoming i
       FULL JOIN outgoing o ON i.month = o.month
       FULL JOIN refunds r  ON COALESCE(i.month, o.month) = r.month
     )
     SELECT month, cash, cc_this_cycle, cc_next_cycle, income AS charged, planned AS settled,
       (income - planned) AS net,
       SUM(income - planned) OVER (ORDER BY month) AS total_net
     FROM combined ORDER BY month`,
    [id],
    (error, results) => {
      if (error) {
        console.log(error);
        return response.status(400).send(`Expense report error.`);
      }
      response.status(200).json(results.rows);
    }
  );
};

const getAllExpenseReport = async (request, response) => {
  pool.query(
    `WITH incoming AS (
       SELECT
         date_trunc('month', bt.date) AS month,
         COALESCE(SUM(CASE WHEN fb.boxtypeid = 6 THEN bt.amount ELSE 0 END), 0) AS cash,
         COALESCE(SUM(CASE WHEN fb.boxtypeid = 2 AND EXTRACT(DAY FROM bt.date) <= COALESCE(fb.settlement, 31) THEN bt.amount ELSE 0 END), 0) AS cc_this_cycle,
         COALESCE(SUM(CASE WHEN fb.boxtypeid = 2 AND EXTRACT(DAY FROM bt.date) >  COALESCE(fb.settlement, 31) THEN bt.amount ELSE 0 END), 0) AS cc_next_cycle,
         COALESCE(SUM(bt.amount), 0) AS income
       FROM box_transactions bt
       JOIN boxes fb ON fb.id = bt.frombox
       WHERE bt.tobox IN (SELECT id FROM boxes WHERE boxtypeid = 3)
       GROUP BY month
     ),
     refunds AS (
       SELECT
         date_trunc('month', bt.date) AS month,
         COALESCE(SUM(bt.amount), 0) AS total_refund
       FROM box_transactions bt
       JOIN boxes tb ON tb.id = bt.tobox
       WHERE bt.frombox IN (SELECT id FROM boxes WHERE boxtypeid = 3)
         AND tb.boxtypeid = 6
       GROUP BY month
     ),
     outgoing AS (
       SELECT month, SUM(planned) AS planned
       FROM (
         SELECT
           date_trunc('month', bt.date) AS month,
           bt.frombox,
           CASE
             WHEN COUNT(*) FILTER (WHERE bt.info->>'type' = 'budget') > 0
             THEN COALESCE(SUM(bt.amount) FILTER (WHERE bt.info->>'type' = 'budget'), 0)
             ELSE COALESCE(SUM(bt.amount) FILTER (WHERE bt.info->>'type' IS DISTINCT FROM 'budget'), 0)
           END AS planned
         FROM box_transactions bt
         JOIN boxes tb ON tb.id = bt.tobox
         WHERE bt.frombox IN (SELECT id FROM boxes WHERE boxtypeid = 3)
           AND tb.boxtypeid = 5
         GROUP BY date_trunc('month', bt.date), bt.frombox
       ) per_cat
       GROUP BY month
     ),
     combined AS (
       SELECT
         COALESCE(i.month, o.month, r.month) AS month,
         COALESCE(i.cash, 0)                                        AS cash,
         COALESCE(i.cc_this_cycle, 0)                               AS cc_this_cycle,
         COALESCE(i.cc_next_cycle, 0)                               AS cc_next_cycle,
         COALESCE(i.income, 0) - COALESCE(r.total_refund, 0)       AS income,
         COALESCE(o.planned, 0)                                     AS planned
       FROM incoming i
       FULL JOIN outgoing o ON i.month = o.month
       FULL JOIN refunds r  ON COALESCE(i.month, o.month) = r.month
     )
     SELECT month, cash, cc_this_cycle, cc_next_cycle, income AS charged, planned AS settled,
       (income - planned) AS net,
       SUM(income - planned) OVER (ORDER BY month) AS total_net
     FROM combined ORDER BY month`,
    (error, results) => {
      if (error) {
        console.log(error);
        return response.status(400).send(`Expense report error.`);
      }
      response.status(200).json(results.rows);
    }
  );
};

const getSummaries = async (request, response) => {
  pool.query(
    `WITH
monthly_income AS (
  SELECT date_trunc('month', date) AS month,
    coalesce(sum(amount), 0.00) AS t_income
  FROM box_transactions
  WHERE frombox IN (SELECT id FROM boxes WHERE boxtypeid = 1)
    AND tobox   IN (SELECT id FROM boxes WHERE boxtypeid = 6)
  GROUP BY month
),
monthly_cc_expense AS (
  SELECT
    date_trunc('month',
      CASE
        WHEN EXTRACT(DAY FROM bt.date) <= COALESCE(b.settlement, 31)
        THEN bt.date
        ELSE bt.date + interval '1 month'
      END
    ) AS month,
    coalesce(sum(bt.amount), 0.00) AS t_creditcard_expense
  FROM box_transactions bt
  JOIN boxes b ON b.id = bt.frombox
  WHERE bt.frombox IN (SELECT id FROM boxes WHERE boxtypeid = 2)
    AND bt.tobox NOT IN (SELECT id FROM boxes WHERE boxtypeid = 2)
    AND bt.tobox NOT IN (SELECT id FROM boxes WHERE boxtypeid = 6)
  GROUP BY month
),
monthly_cc_pending AS (
  SELECT date_trunc('month', bt.date) AS month,
    coalesce(sum(bt.amount), 0.00) AS t_cc_pending
  FROM box_transactions bt
  JOIN boxes fb ON fb.id = bt.frombox
  WHERE bt.frombox IN (SELECT id FROM boxes WHERE boxtypeid = 2)
    AND bt.tobox NOT IN (SELECT id FROM boxes WHERE boxtypeid = 2)
    AND bt.tobox NOT IN (SELECT id FROM boxes WHERE boxtypeid = 6)
    AND EXTRACT(DAY FROM bt.date) > COALESCE(fb.settlement, 31)
  GROUP BY month
),
monthly_direct_expense AS (
  SELECT date_trunc('month', date) AS month,
    coalesce(sum(amount), 0.00) AS t_direct_expense
  FROM box_transactions
  WHERE frombox IN (SELECT id FROM boxes WHERE boxtypeid = 6)
    AND tobox   IN (SELECT id FROM boxes WHERE boxtypeid = 3)
  GROUP BY month
),
monthly_expense_refunds AS (
  SELECT date_trunc('month', date) AS month,
    coalesce(sum(amount), 0.00) AS t_refunds
  FROM box_transactions
  WHERE frombox IN (SELECT id FROM boxes WHERE boxtypeid = 3)
    AND tobox   IN (SELECT id FROM boxes WHERE boxtypeid = 6)
  GROUP BY month
),
combined AS (
  SELECT
    coalesce(i.month, cc.month, d.month, cp.month, ref.month) AS month,
    coalesce(i.t_income, 0.00)               AS t_income,
    coalesce(cc.t_creditcard_expense, 0.00)  AS t_creditcard_expense,
    coalesce(d.t_direct_expense, 0.00) - coalesce(ref.t_refunds, 0.00) AS t_direct_expense,
    coalesce(cp.t_cc_pending, 0.00)          AS t_cc_pending
  FROM monthly_income i
  FULL JOIN monthly_cc_expense     cc  ON i.month = cc.month
  FULL JOIN monthly_direct_expense d   ON coalesce(i.month, cc.month) = d.month
  FULL JOIN monthly_cc_pending     cp  ON coalesce(i.month, cc.month, d.month) = cp.month
  FULL JOIN monthly_expense_refunds ref ON coalesce(i.month, cc.month, d.month, cp.month) = ref.month
)
SELECT month,
  t_income,
  t_creditcard_expense,
  t_direct_expense,
  t_cc_pending,
  (t_creditcard_expense + t_direct_expense) AS t_expense,
  (t_income - t_creditcard_expense - t_direct_expense) AS balance
FROM combined
ORDER BY month`,
    (error, results) => {
      if (error) {
        console.log(error);
        return response.status(400).send(`Summaries error.`);
      }
      response.status(200).json(results.rows);
    }
  );
};

const getBoxTypes = async (request, response) => {
  pool.query('SELECT * FROM box_types ORDER BY id', (error, results) => {
    if (error) {
      console.log(error);
      return response.status(404).send('Get box types error.');
    }
    response.status(200).json(results.rows);
  });
};

const getStorages = async (request, response) => { await getboxfunction(6, request, response); };
const addStorage = async (request, response) => { await addboxfunction(6, request, response); };
const updateStorage = (request, response) => { updateboxfunction(request, response); };
const deleteStorage = (request, response) => { deleteboxfunction(request, response); };

const getStorageReport = async (request, response) => {
  const id = parseInt(request.params.id);
  pool.query(
    `WITH cte AS (SELECT date_trunc('month', DATE) AS month, coalesce(sum(amount), 0) AS income FROM box_transactions WHERE tobox = $1 GROUP BY month ORDER BY month),
     cte2 AS (SELECT date_trunc('month', DATE) AS month, coalesce(sum(amount), 0) AS expense FROM box_transactions WHERE frombox = $1 GROUP BY month ORDER BY month),
     cte3 AS (SELECT coalesce(cte.month, cte2.month) AS month, coalesce(cte.income, 0) AS income, coalesce(cte2.expense, 0) AS expense FROM cte FULL JOIN cte2 ON cte.month = cte2.month ORDER BY month)
     SELECT *, (cte3.income-cte3.expense) as balance, sum(cte3.income-cte3.expense) OVER (ORDER BY month) total_balance FROM cte3 ORDER BY month`,
    [id], (error, results) => {
      if (error) { console.log(error); return response.status(400).send('Storage report error.'); }
      response.status(200).json(results.rows);
    }
  );
};

const getAllStorageReport = async (request, response) => {
  pool.query(
    `WITH cte AS (SELECT date_trunc('month', DATE) AS month, coalesce(sum(amount), 0) AS income FROM box_transactions WHERE tobox IN (SELECT id FROM boxes WHERE boxtypeid = 6) GROUP BY month ORDER BY month),
     cte2 AS (SELECT date_trunc('month', DATE) AS month, coalesce(sum(amount), 0) AS expense FROM box_transactions WHERE frombox IN (SELECT id FROM boxes WHERE boxtypeid = 6) GROUP BY month ORDER BY month),
     cte3 AS (SELECT coalesce(cte.month, cte2.month) AS month, coalesce(cte.income, 0) AS income, coalesce(cte2.expense, 0) AS expense FROM cte FULL JOIN cte2 ON cte.month = cte2.month ORDER BY month)
     SELECT *, (cte3.income-cte3.expense) as balance, sum(cte3.income-cte3.expense) OVER (ORDER BY month) total_balance FROM cte3 ORDER BY month`,
    (error, results) => {
      if (error) { console.log(error); return response.status(400).send('Storage report error.'); }
      response.status(200).json(results.rows);
    }
  );
};

const getInvestments = async (request, response) => { await getboxfunction(7, request, response); };
const addInvestment = async (request, response) => { await addboxfunction(7, request, response); };
const updateInvestment = (request, response) => { updateboxfunction(request, response); };
const deleteInvestment = (request, response) => { deleteboxfunction(request, response); };

const getInvestmentReport = async (request, response) => {
  const id = parseInt(request.params.id);
  pool.query(
    `WITH cte AS (SELECT date_trunc('month', DATE) AS month, coalesce(sum(amount), 0) AS income FROM box_transactions WHERE tobox = $1 GROUP BY month ORDER BY month),
     cte2 AS (SELECT date_trunc('month', DATE) AS month, coalesce(sum(amount), 0) AS expense FROM box_transactions WHERE frombox = $1 GROUP BY month ORDER BY month),
     cte3 AS (SELECT coalesce(cte.month, cte2.month) AS month, coalesce(cte.income, 0) AS income, coalesce(cte2.expense, 0) AS expense FROM cte FULL JOIN cte2 ON cte.month = cte2.month ORDER BY month)
     SELECT *, (cte3.income-cte3.expense) as balance, sum(cte3.income-cte3.expense) OVER (ORDER BY month) total_balance FROM cte3 ORDER BY month`,
    [id], (error, results) => {
      if (error) { console.log(error); return response.status(400).send('Investment report error.'); }
      response.status(200).json(results.rows);
    }
  );
};

const getAllInvestmentReport = async (request, response) => {
  pool.query(
    `WITH cte AS (SELECT date_trunc('month', DATE) AS month, coalesce(sum(amount), 0) AS income FROM box_transactions WHERE tobox IN (SELECT id FROM boxes WHERE boxtypeid = 7) GROUP BY month ORDER BY month),
     cte2 AS (SELECT date_trunc('month', DATE) AS month, coalesce(sum(amount), 0) AS expense FROM box_transactions WHERE frombox IN (SELECT id FROM boxes WHERE boxtypeid = 7) GROUP BY month ORDER BY month),
     cte3 AS (SELECT coalesce(cte.month, cte2.month) AS month, coalesce(cte.income, 0) AS income, coalesce(cte2.expense, 0) AS expense FROM cte FULL JOIN cte2 ON cte.month = cte2.month ORDER BY month)
     SELECT *, (cte3.income-cte3.expense) as balance, sum(cte3.income-cte3.expense) OVER (ORDER BY month) total_balance FROM cte3 ORDER BY month`,
    (error, results) => {
      if (error) { console.log(error); return response.status(400).send('Investment report error.'); }
      response.status(200).json(results.rows);
    }
  );
};

const getGenerators = async (request, response) => { await getboxfunction(4, request, response); };

const getBoxDirections = async (request, response) => {
  pool.query(
    `SELECT bd.id, bd.fromid, ft.name AS from_name, bd.toid, tt.name AS to_name
     FROM box_directions bd
     JOIN box_types ft ON ft.id = bd.fromid
     JOIN box_types tt ON tt.id = bd.toid
     ORDER BY bd.id`,
    (error, results) => {
      if (error) { console.log(error); return response.status(400).send('Box directions error.'); }
      response.status(200).json(results.rows);
    }
  );
};
const getDestroyers = async (request, response) => { await getboxfunction(5, request, response); };

const getInstallmentPlans = async (request, response) => {
  pool.query(
    `SELECT ip.*, b.name AS expense_name, pb.name AS payment_box_name,
       COALESCE(ip.total_amount, ip.total_installments * ip.amount_per_month) AS total_amount,
       (SELECT COUNT(*) FROM box_transactions bt
        WHERE bt.frombox = ip.expense_box_id
          AND (bt.info->>'plan_id')::int = ip.id
          AND bt.date <= CURRENT_DATE) AS elapsed_count
     FROM installment_plans ip
     JOIN boxes b ON b.id = ip.expense_box_id
     LEFT JOIN boxes pb ON pb.id = ip.payment_box_id
     ORDER BY ip.start_date`,
    (error, results) => {
      if (error) { console.log(error); return response.status(400).send('Installment plans error.'); }
      response.status(200).json(results.rows);
    }
  );
};

const getInstallmentPlan = async (request, response) => {
  const id = parseInt(request.params.id);
  pool.query(
    `SELECT bt.id, bt.date, bt.amount,
       (bt.info->>'installment_no')::int AS installment_no,
       (bt.info->>'total')::int AS total
     FROM box_transactions bt
     JOIN installment_plans ip ON (bt.info->>'plan_id')::int = ip.id
     WHERE ip.id = $1
     ORDER BY bt.date`,
    [id],
    (error, results) => {
      if (error) { console.log(error); return response.status(400).send('Installment plan detail error.'); }
      response.status(200).json(results.rows);
    }
  );
};

const createInstallmentPlan = async (request, response) => {
  const { description, expense_box_id, payment_box_id, start_date, total_installments, total_amount } = request.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const destroyerResult = await client.query(
      `SELECT id FROM boxes WHERE boxtypeid = 5 LIMIT 1`
    );
    if (destroyerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return response.status(400).send('Destroyer box bulunamadı.');
    }
    const destroyerId = destroyerResult.rows[0].id;

    // Aylık tutarı kuruşa yuvarlayarak hesapla
    const amount_per_month = Math.round(total_amount / total_installments * 100) / 100;
    // Son taksit artığı kapatsın (yuvarlama farkı)
    const last_amount = Math.round((total_amount - (total_installments - 1) * amount_per_month) * 100) / 100;

    const planResult = await client.query(
      `INSERT INTO installment_plans (description, expense_box_id, payment_box_id, start_date, total_installments, amount_per_month, total_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [description, expense_box_id, payment_box_id || null, start_date, total_installments, amount_per_month, total_amount]
    );
    const planId = planResult.rows[0].id;

    const baseDate = new Date(start_date + 'T00:00:00');
    const baseDay = baseDate.getDate();
    for (let i = 1; i <= total_installments; i++) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + (i - 1), 1);
      const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(baseDay, maxDay));
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const txAmount = (i === total_installments) ? last_amount : amount_per_month;
      await client.query(
        `INSERT INTO box_transactions (date, frombox, tobox, description, amount, info)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [dateStr, expense_box_id, destroyerId, description, txAmount,
         JSON.stringify({ plan_id: planId, installment_no: i, total: total_installments })]
      );
    }

    await client.query('COMMIT');
    response.status(201).json({ id: planId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    response.status(500).send('Installment plan create error.');
  } finally {
    client.release();
  }
};

const deleteInstallmentPlan = async (request, response) => {
  const id = parseInt(request.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM box_transactions WHERE (info->>'plan_id')::int = $1`,
      [id]
    );
    await client.query('DELETE FROM installment_plans WHERE id = $1', [id]);
    await client.query('COMMIT');
    response.status(200).send(`Installment plan deleted with ID: ${id}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    response.status(500).send('Installment plan delete error.');
  } finally {
    client.release();
  }
};

const getFlows = async (request, response) => {
  const start = request.query.start || null;
  const end = request.query.end || null;
  pool.query(
    `SELECT
      bt.frombox, fb.name AS from_name, fbt.name AS from_type,
      bt.tobox,   tb.name AS to_name,   tbt.name AS to_type,
      SUM(bt.amount)::numeric AS total
    FROM box_transactions bt
    JOIN boxes fb    ON fb.id  = bt.frombox
    JOIN box_types fbt ON fbt.id = fb.boxtypeid
    JOIN boxes tb    ON tb.id  = bt.tobox
    JOIN box_types tbt ON tbt.id = tb.boxtypeid
    WHERE ($1::date IS NULL OR bt.date >= $1::date)
      AND ($2::date IS NULL OR bt.date <= $2::date)
    GROUP BY bt.frombox, fb.name, fbt.name, bt.tobox, tb.name, tbt.name
    HAVING SUM(bt.amount) > 0
    ORDER BY total DESC`,
    [start, end],
    (error, results) => {
      if (error) { console.log(error); return response.status(400).send('Flows error.'); }
      response.status(200).json(results.rows);
    }
  );
};

const getbalances = async (request, response) => {
  const asOf = request.query.asOf || null;
  pool.query(
    `SELECT b.id, b.name, b.boxtypeid,
      CASE
        WHEN b.boxtypeid IN (6, 7) THEN
          COALESCE(
            SUM(CASE WHEN bt.tobox   = b.id THEN bt.amount::numeric ELSE 0 END) -
            SUM(CASE WHEN bt.frombox = b.id THEN bt.amount::numeric ELSE 0 END),
          0)
        WHEN b.boxtypeid = 2 THEN
          COALESCE(
            SUM(CASE WHEN bt.frombox = b.id THEN bt.amount::numeric ELSE 0 END) -
            SUM(CASE WHEN bt.tobox   = b.id THEN bt.amount::numeric ELSE 0 END),
          0)
        ELSE 0
      END AS balance
     FROM boxes b
     LEFT JOIN box_transactions bt ON (bt.frombox = b.id OR bt.tobox = b.id) AND ($1::date IS NULL OR bt.date <= $1::date)
     WHERE b.boxtypeid IN (2, 6, 7) AND b.name != 'Void'
     GROUP BY b.id, b.name, b.boxtypeid
     ORDER BY b.boxtypeid, b.name`,
    [asOf],
    (error, results) => {
      if (error) { console.log(error); return response.status(400).send('Balances error.'); }
      response.status(200).json(results.rows);
    }
  );
};

const getCreditCardMonthlyTransactions = async (request, response) => {
  const id = parseInt(request.params.id);
  const month = request.query.month;
  if (!month) {
    return response.status(400).send('month parameter required (YYYY-MM)');
  }
  pool.query(
    `SELECT bt.id, bt.date, bt.description, bt.amount, b.name AS category
     FROM box_transactions bt
     JOIN boxes b    ON b.id    = bt.tobox
     JOIN boxes card ON card.id = bt.frombox
     WHERE bt.frombox = $1
       AND date_trunc('month',
         CASE
           WHEN EXTRACT(DAY FROM bt.date) <= COALESCE(card.settlement, 31)
           THEN bt.date
           ELSE bt.date + interval '1 month'
         END
       ) = date_trunc('month', ($2 || '-01')::date)
     ORDER BY bt.date`,
    [id, month],
    (error, results) => {
      if (error) {
        console.log(error);
        return response.status(400).send('Credit card monthly transactions error.');
      }
      response.status(200).json(results.rows);
    }
  );
};

const getPeriodSummary = async (request, response) => {
  const start = request.query.start || null;
  const end = request.query.end || null;
  pool.query(
    `SELECT
       b.id,
       b.name,
       bt.id   AS boxtypeid,
       bt.name AS type,
       COALESCE(SUM(CASE WHEN tx.tobox   = b.id THEN tx.amount ELSE 0 END), 0) AS total_in,
       COALESCE(SUM(CASE WHEN tx.frombox = b.id THEN tx.amount ELSE 0 END), 0) AS total_out,
       COALESCE(SUM(CASE WHEN tx.tobox   = b.id THEN tx.amount ELSE 0 END), 0) -
       COALESCE(SUM(CASE WHEN tx.frombox = b.id THEN tx.amount ELSE 0 END), 0) AS net
     FROM boxes b
     JOIN box_types bt ON bt.id = b.boxtypeid
     LEFT JOIN box_transactions tx
       ON (tx.tobox = b.id OR tx.frombox = b.id)
       AND ($1::date IS NULL OR tx.date >= $1::date)
       AND ($2::date IS NULL OR tx.date <= $2::date)
     WHERE b.boxtypeid NOT IN (4, 5)
     GROUP BY b.id, b.name, bt.id, bt.name
     ORDER BY bt.id, b.name`,
    [start, end],
    (error, results) => {
      if (error) { console.log(error); return response.status(400).send('Period summary error.'); }
      response.status(200).json(results.rows);
    }
  );
};

const getMonthlyExpenseBreakdown = async (request, response) => {
  const month = request.query.month;
  if (!month) {
    return response.status(400).send('month parameter required (format: YYYY-MM)');
  }
  pool.query(
    `SELECT name, SUM(total) AS total
     FROM (
       SELECT b.name, SUM(bt.amount) AS total
       FROM box_transactions bt
       JOIN boxes b ON b.id = bt.tobox
       WHERE b.boxtypeid = 3
         AND date_trunc('month', bt.date) = date_trunc('month', ($1 || '-01')::date)
       GROUP BY b.name
       UNION ALL
       SELECT b.name, -SUM(bt.amount) AS total
       FROM box_transactions bt
       JOIN boxes b  ON b.id  = bt.frombox
       JOIN boxes tb ON tb.id = bt.tobox
       WHERE b.boxtypeid = 3
         AND tb.boxtypeid = 6
         AND date_trunc('month', bt.date) = date_trunc('month', ($1 || '-01')::date)
       GROUP BY b.name
     ) combined
     GROUP BY name
     HAVING SUM(total) > 0
     ORDER BY total DESC`,
    [month],
    (error, results) => {
      if (error) {
        console.log(error);
        return response.status(400).send('Monthly expense breakdown error.');
      }
      response.status(200).json(results.rows);
    }
  );
};

module.exports = {
  seedDatabase,
  formatdb,
  getBoxTypes,
  getFlows,
  getIncomes,
  getCreditCards,
  getExpenseTypes,
  getStorages,
  getInvestments,
  getGenerators,
  getDestroyers,
  getBoxDirections,
  getbalances,
  addIncome,
  addCreditCard,
  addExpenseType,
  addStorage,
  addInvestment,
  updateIncome,
  updateCreditCard,
  updateExpenseType,
  updateStorage,
  updateInvestment,
  deleteIncome,
  deleteCreditCard,
  deleteExpenseType,
  deleteStorage,
  deleteInvestment,
  getAllBoxes,
  gettransactions,
  addtransaction,
  addincometransaction,
  updatetransaction,
  deletetransaction,
  getIncomeReport,
  getCreditCardReport,
  getAllCreditCardReport,
  getExpenseReport,
  getAllExpenseReport,
  getStorageReport,
  getAllStorageReport,
  getInvestmentReport,
  getAllInvestmentReport,
  getSummaries,
  getInstallmentPlans,
  getInstallmentPlan,
  createInstallmentPlan,
  deleteInstallmentPlan,
  getMonthlyExpenseBreakdown,
  getCreditCardMonthlyTransactions,
  getPeriodSummary
};
