const express = require('express');
const WebSocket = require('ws');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
require("dotenv").config();
const db = require("./database/db");
const port = process.env.PORT;

const app = express();

const store = new MongoStore({
    mongooseConnection: db,
    collection: 'sessions',
    ttl: 14 * 24 * 60 * 60 // Session data will be removed after 14 days
  });
// configure session middleware with MongoStore
app.use(session({
    secret: 'my-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true },
    store: store
  }));


// Configure session middleware with MongoStore
app.use(session({
    secret: process.env.MY_SWEETSECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true },
    store: store
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

const server = app.listen(port, () => {
  console.log(`Server listening on port ${process.env.PORT}`);
});

const wss = new WebSocket.Server({ server });


// Function to generate a unique device ID based on the user agent
function generateDeviceId(userAgent) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(userAgent);
    return hash.digest('hex');
}

app.use((req, res, next) => {
    const userAgent = req.headers['user-agent'];
    req.session.deviceId = generateDeviceId(userAgent); // Generate a unique device ID based on the user agent
    next();
});
  

  wss.on('connection', (ws, req) => {
    console.log('WebSocket connected');
  
    // Get the session object for the user
    const sessionId = req.session.id;
    const deviceId = req.session.deviceId;
  
    // Use the session ID and device ID to retrieve the session from the database
  req.sessionStore.get(sessionId, (err, session) => {
    if (err) {
        console.error(err);
        } else if (!session || session.deviceId !== deviceId) {
            console.log('Invalid session');
            } else {
            // Handle incoming messages from the WebSocket
            ws.on('message', (message) => {
                console.log(`WebSocket received message: ${message}`);

                // Get the current order for the user from the session
                let currentOrder = session.currentOrder || [];

                const response = generateResponse(message);
                ws.send(response);

                // Update the session with the new order
                session.currentOrder = currentOrder;
                req.sessionStore.set(sessionId, session, (err) => {
                if (err) {
                    console.error(err);
                }
                }); // Save the session back to the database
            });
        }
    });
});

const greeting = ["hello there, i'm chillyBot,", "Hi dev, How can I assist you today?", "Ola! como t'e yamo", "Egbon mi!"]

app.get('/', (req, res) => {
    const randomIndex = Math.floor(Math.random() * greeting.length);
  const response = 
  `${greeting[randomIndex]}! Select 1 to get started!`;
  
  res.render('index', {message: response});
});

app.post('/message', (req, res) => {
  const message = req.body.message;
  console.log(`Received message: ${message}`);

  // Get the current order for the user from the session
  let currentOrder = req.session.currentOrder || [];

  const response = generateResponse(message);
  res.send({ message: response });

  // Update the session with the new order
  req.session.currentOrder = currentOrder;
});


const menu = [
  { id: '1', name: 'Burger', price: 4500 },
  { id: '2', name: 'Pizza', price: 3500 },
  { id: '3', name: 'Pasta', price: 2000 },
  { id: '4', name: 'Salad', price: 1500 }
];

let currentOrder = [];
let orderHistory = [];

let state = 'initial';

function generateResponse(message) {
  let response = '';
  switch (state) {
    case 'initial':
      response = 'Hello! How can I assist you today? \n\n'
                + 'Select 1 to place an order\n'
                + 'Select 99 to checkout order\n'
                + 'Select 98 to see order history\n'
                + 'Select 97 to see current order\n'
                + 'Select 0 to cancel order';
      if (message === '1') {
        state = 'menu';
        response = 'Please select an item from the menu:\n';
        for (let i = 0; i < menu.length; i++) {
          response += `${menu[i].id}. ${menu[i].name} ₦${menu[i].price}\n`;
        }
      } else if (message === '99') {
        state = 'checkout';
        response = currentOrder.length > 0 ? 'Are you sure you want to place your order?' : 'No order to checkout.';
        response += '\n\nSelect 1 to place your order\n';
        response += 'Select 0 to cancel your order';
      } else if (message === '98') {
        state = 'order_history';
        response = orderHistory.length > 0 ? 'Here are your past orders: \n' + orderHistory.join(', ') : 'No past orders found.';
        state = 'initial';
      } else if (message === '97') {
        state = 'current_order';
        response = currentOrder.length > 0 ? 'Here is your current order: ' + currentOrder.join(', ') : 'No current order found.\n'
        response += '\n\n Select 1 to add more items\n';
        response += 'Select 99 to checkout order\n';
        response += 'Select 98 to see order history\n';
        response += 'Select 97 to see current order\n';
        response += 'Select 0 to cancel order';;
        state = 'initial';
      } else if (message === '0') {
        state = 'cancel_order';
        response = 'Are you sure you want to cancel your order?';
        response += '\n\nSelect 1 to confirm cancellation\n';
        response += 'Select 0 to return to your order';
      } else {
        return "Please enter a valid option"
      }
      break;

    case 'menu':
      const selectedItem = menu.find(item => item.id === message);
      if (!selectedItem) {
        response = 'Sorry, that item is not on the menu. Please select a valid item.';
        break;
        }
        currentOrder.push(selectedItem.name);
        response = `${selectedItem.name} has been added to your order.\n\n`;
        response += 'Select 1 to add more items\n';
        response += 'Select 99 to checkout order\n';
        response += 'Select 98 to see order history\n';
        response += 'Select 97 to see current order\n';
        response += 'Select 0 to cancel order';
        state = 'initial';
        break;
        case 'checkout':
        if (message === '1') {
            if (currentOrder.length > 0) {
            orderHistory.push(currentOrder.join(', '));
            currentOrder = [];
            response = 'Your order has been placed successfully!\n\n'
                response += 'Select 1 to place a new order\n'
                response += '\n\n Select 98 to see order history\n'
                response += '\n\n Select 97 to see current order\n'
                response += '\n\n Select 0 to cancel';
            state = 'initial';
            } else {
            response = 'No order to checkout.';
            state = 'initial';
            }
        } else if (message === '0') {
            response = 'Your order has been cancelled.'
                response += '\n\n Select 1 to place a new order'
                response += 'Select 98 to see order history\n'
                response += 'Select 97 to see current order\n';
            currentOrder = [];
            state = 'initial';
        } else {
            response = 'Invalid selection. Please try again.\n\n';
            response += 'Select 1 to place your order\n';
            response += 'Select 0 to cancel your order';
        }
        break;

        case 'cancel_order':
        if (message === '1') {
            response = 'Your order has been cancelled.';
                response += '\n\n Select 1 to place a new order'
                response += '\n\n Select 98 to see order history'
                response += '\n\n Select 97 to see current order';
            currentOrder = [];
            state = 'initial';
        } else if (message === '0') {
            response = 'Your order has not been cancelled.'
                response += '\n\n Select 1 to place a new order'
                response += '\n\n Select 98 to see order history'
                response += '\n\n Select 97 to see current order';
            state = 'initial';
        } else {
            response = 'Invalid selection. Please try again.\n\n';
            response += 'Select 1 to confirm cancellation\n';
            response += 'Select 0 to return to your order';
        }
        break;

        default:
        response = 'Invalid state.';
        break;
        }
    return response;
}
