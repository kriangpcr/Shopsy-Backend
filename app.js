var express = require('express');
var cors = require('cors');
var app = express();
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();
var jwt = require('jsonwebtoken');
const secret = "cpe204";
// database
const mysql = require('mysql2/promise'); // Use promise-based API
const { connect } = require('http2');

// Create connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  database: 'cpe204',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.use(cors());

app.post('/register', jsonParser, async function (req, res, next) {
  try {
    const email = req.body.email;

    // Check if the email already exists
    const connection = await pool.getConnection();
    const [existingUsers, _] = await connection.execute(
      'SELECT * FROM users WHERE email=?',
      [email]
    );
    connection.release();

    if (existingUsers.length > 0) {
      // Email already exists, return an error
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Proceed with registration since email doesn't exist
    const insertConnection = await pool.getConnection();
    const [results, fields] = await insertConnection.execute(
      'INSERT INTO users (email,password,username,fname,lname,birth,gender,phone,money) VALUES (?,?,?,?,?,?,?,?,?)',
      [
        req.body.email,
        req.body.password,
        req.body.username,
        req.body.fname,
        req.body.lname,
        req.body.birth,
        req.body.gender,
        req.body.phone,
        0
      ]
    );
    insertConnection.release(); // Release the connection back to the pool
    res.json({ status: 'Registered' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.post('/login', jsonParser, async function (req, res, next) {
  try {
    const connection = await pool.getConnection();
    const [results, fields] = await connection.execute(
      'SELECT * FROM users WHERE email=? AND password=?',
      [req.body.email, req.body.password]
    );
    connection.release();
    
    if (results.length > 0) {
      // User authenticated successfully
      const user = results[0];
      const token = jwt.sign({ email: user.email,fname:user.fname,lname:user.lname,money:user.money,id:user.id }, secret, { expiresIn: '1h' }); // Create JWT token
      res.json({ token: token ,email:user.email});
    } else {
      // Invalid credentials
      res.status(401).json({ error: 'Invalid email or password' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/authen', jsonParser, async function (req, res, next) {
  try {
    // Check if Authorization header exists
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract the token from the Authorization header
    const token = req.headers.authorization.split(' ')[1];

    // Verify the token
    const decoded = jwt.verify(token, secret);

    // Respond with the decoded token
    res.json({ decoded });
  } catch (error) {
    console.error(error);
    // If token verification fails, respond with Unauthorized status
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.post('/topup', jsonParser, async function (req, res, next) {
  try {
    const connection = await pool.getConnection();
    const [results, fields] = await connection.execute(
      'SELECT * FROM users WHERE email=?',
      [req.body.email]
    );

    if (results.length === 0) {
      // User not found
      connection.release();
      return res.status(404).json({ error: 'User not found' });
    }

    const user = results[0];
    const currentMoney = user.money || 0; // Default to 0 if `money` is null/undefined

    // Assuming you want to add the amount specified in the request body to the current money
    const updatedMoney = currentMoney + req.body.amount;

    // Update the `money` column for the user
    await connection.execute(
      'UPDATE users SET money=? WHERE email=?',
      [updatedMoney, req.body.email]
    );

    connection.release();
    res.status(200).json({ message: 'เติมเงินสำเร็จ' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/userinfo', jsonParser, async function (req, res, next) {
  try {
    // Check if email is provided in the request body
    const email = req.body.email;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Retrieve user info based on email
    const connection = await pool.getConnection();
    const [results, fields] = await connection.execute(
      'SELECT * FROM users WHERE email=?',
      [email]
    );
    connection.release();

    if (results.length === 0) {
      // User not found
      return res.status(404).json({ error: 'User not found' });
    }

    // User found, respond with user info
    const user = results[0];
    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/products', jsonParser, async (req, res) => {
  try {
      let query = 'SELECT * FROM products';
      const { catalog } = req.body;
      if (catalog) {
          query += ` WHERE catalog = '${catalog}'`;
      }
      const connection = await pool.getConnection();
      const [rows, fields] = await connection.execute(query);
      connection.release();
      res.json({ products: rows });
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/productdetail', jsonParser, async (req, res) => {
  try {
      let query = 'SELECT * FROM products';
      const { id } = req.body;
      if (id) {
          query += ` WHERE Pid = ${id}`;
      }
      const connection = await pool.getConnection();
      const [rows, fields] = await connection.execute(query);
      connection.release();
      res.json({ products: rows[0] });
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/editinfo', jsonParser, async (req, res) => {
  try {
    // Check if email is provided in the request body
    const { email, username, fname, lname, birth, gender, phone } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if the user exists
    const connection = await pool.getConnection();
    const [existingUsers, _] = await connection.execute(
      'SELECT * FROM users WHERE email=?',
      [email]
    );

    if (existingUsers.length === 0) {
      // User not found
      connection.release();
      return res.status(404).json({ error: 'User not found' });
    }

    // Construct the SQL query based on provided fields
    let updateQuery = 'UPDATE users SET';
    const updateParams = [];
    if (username !== undefined) {
      updateQuery += ' username=?,';
      updateParams.push(username);
    }
    if (fname !== undefined) {
      updateQuery += ' fname=?,';
      updateParams.push(fname);
    }
    if (lname !== undefined) {
      updateQuery += ' lname=?,';
      updateParams.push(lname);
    }
    if (birth !== undefined) {
      updateQuery += ' birth=?,';
      updateParams.push(birth);
    }
    if (gender !== undefined) {
      updateQuery += ' gender=?,';
      updateParams.push(gender);
    }
    if (phone !== undefined) {
      updateQuery += ' phone=?,';
      updateParams.push(phone);
    }

    // Remove the trailing comma and add the WHERE clause
    updateQuery = updateQuery.slice(0, -1) + ' WHERE email=?';
    updateParams.push(email);

    // Update user info
    await connection.execute(updateQuery, updateParams);

    connection.release();
    res.status(200).json({ message: 'อัพเดตข้อมูลเสร็จสิ้น' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/buynow', jsonParser, async (req, res) => {
  try {
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract the token from the Authorization header
    const token = req.headers.authorization.split(' ')[1];

    // Verify the token
    const decoded = jwt.verify(token, secret);

    // Check if user exists and get user's current balance
    const connection = await pool.getConnection();
    const [userResults, _] = await connection.execute(
      'SELECT * FROM users WHERE id=?',
      [decoded.id]
    );

    if (userResults.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResults[0];
    const currentMoney = user.money || 0;

    // Check if the user has enough money to make the purchase
    const purchaseAmount = req.body.amount; // Assuming you send the purchase amount in the request body
    if (currentMoney < purchaseAmount) {
      connection.release();
      return res.status(400).json({ error: 'เงินหมดหรือป่าวค้าบบ' });
    }

    // Deduct the purchase amount from the user's balance
    const updatedMoney = currentMoney - purchaseAmount;
    await connection.execute(
      'UPDATE users SET money=? WHERE id=?',
      [updatedMoney, decoded.id]
    );

    // Save purchase history with additional fields (name, img, and price)
    const name = req.body.name || null; // Handle undefined by converting to null
    const img = req.body.img || null; // Handle undefined by converting to null
    const price = req.body.price || null; // Handle undefined by converting to null

    await connection.execute(
      'INSERT INTO historybuy (id_user, Pid, name, img, date, price) VALUES (?, ?, ?, ?, ?, ?)',
      [decoded.id, req.body.productId, name, img, req.body.datetime, price]
    );

    connection.release();
    res.status(200).json({ message: 'ซื้อสำเร็จ' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error });
  }
});



app.post('/historybuy', jsonParser, async (req, res) => {
  try {
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = req.headers.authorization.split(' ')[1];

    const decoded = jwt.verify(token, secret);

    const connection = await pool.getConnection();
    const [userResults, _1] = await connection.execute(
      'SELECT * FROM users WHERE id=?',
      [decoded.id]
    );

    if (userResults.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'User not found' });
    }

    const [historyResults, _2] = await connection.execute(
      'SELECT * FROM historybuy WHERE id_user=?',
      [decoded.id]
    );

    connection.release();

    res.json({ history: historyResults });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/addtocart', jsonParser, async (req, res) => {
  try {
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract the token from the Authorization header
    const token = req.headers.authorization.split(' ')[1];

    // Verify the token
    const decoded = jwt.verify(token, secret);

    // Check if user exists
    const connection = await pool.getConnection();
    const [userResults, _] = await connection.execute(
      'SELECT * FROM users WHERE id=?',
      [decoded.id]
    );

    if (userResults.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'User not found' });
    }

    // Assuming req.body contains the product details such as Pid, name, and price
    const { Pid, name, price, img } = req.body;

    // Add the product to the user's shopping cart
    await connection.execute(
      'INSERT INTO cart (userid, Pid, name, price, img) VALUES (?, ?, ?, ?, ?)',
      [decoded.id, Pid, name, price, img]
    );

    connection.release();
    res.status(200).json({ message: 'เพิ่มลงตะกร้าเรียบร้อย' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.post('/showcart', jsonParser, async (req, res) => {
  try {
    // Check if Authorization header exists
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract the token from the Authorization header
    const token = req.headers.authorization.split(' ')[1];

    // Verify the token
    const decoded = jwt.verify(token, secret);

    // Extract the user ID from the decoded token
    const userid = decoded.id;

    // Query the database to retrieve cart items for the user
    const connection = await pool.getConnection();
    const [cartItems, _] = await connection.execute(
      'SELECT * FROM cart WHERE userid=?',
      [userid]
    );
    connection.release();

    // Respond with the cart items
    res.status(200).json({ cartItems });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.post('/addproducts', jsonParser, async (req, res) => {
  try {
    const { img, name, description, price, catalog, sold } = req.body;

    // Insert the product into the database
    const connection = await pool.getConnection();
    const [results, fields] = await connection.execute(
      'INSERT INTO products (img, name, description, price, catalog, sold) VALUES (?, ?, ?, ?, ?, ?)',
      [img, name, description, price, catalog, sold]
    );
    connection.release(); // Release the connection back to the pool

    res.status(200).json({ message: 'Product added successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});




app.listen(3333, function () {
  console.log('CORS-enabled web server listening on port 3333');
});
