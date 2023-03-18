const express = require('express');
const WebSocket = require('ws');
const session = require('express-session');
require("dotenv").config();
const port = process.env.PORT || 3040;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

// Configure session middleware
app.use(session({
  secret: 'my-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}));  


const server = app.listen(process.env.PORT, () => {
  console.log(`Server listening on port ${process.env.PORT}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('WebSocket connected');

  // Get the session object for the user
  const session = req.session;

  // Handle incoming messages from the WebSocket
  ws.on('message', (message) => {
    console.log(`WebSocket received message: ${message}`);

    // Get the current order for the user from the session
    let currentOrder = session.currentOrder || [];

    const response = generateResponse(message);
    ws.send(response);

    // Update the session with the new order
    session.currentOrder = currentOrder;
  });
});

app.get('/', (req, res) => {
  const response = 'Hello! How can I assist you today?\n\n'
    + 'Select 1 to place an order\n'
    + 'Select 99 to checkout order\n'
    + 'Select 98 to see order history\n'
    + 'Select 97 to see current order\n'
    + 'Select 0 to cancel order';
  res.render('index', {message: response });
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
      response = 'Hello! How can I assist you today?\n\n'
                + 'Select 1 to place an order\n'
                + 'Select 99 to checkout order\n'
                + 'Select 98 to see order history\n'
                + 'Select 97 to see current order\n'
                + 'Select 0 to cancel order';
      if (message === '1') {
        state = 'menu';
        response = 'Please select an item from the menu:\n';
        for (let i = 0; i < menu.length; i++) {
          response += `${menu[i].id}. ${menu[i].name} ($${menu[i].price})\n`;
        }
      } else if (message === '99') {
        state = 'checkout';
        response = currentOrder.length > 0 ? 'Are you sure you want to place your order?' : 'No order to checkout.';
        response += '\n\nSelect 1 to place your order\n';
        response += 'Select 0 to cancel your order';
      } else if (message === '98') {
        state = 'order_history';
        response = orderHistory.length > 0 ? 'Here are your past orders: ' + orderHistory.join(', ') : 'No past orders found.';
        state = 'initial';
      } else if (message === '97') {
        state = 'current_order';
        response = currentOrder.length > 0 ? 'Here is your current order: ' + currentOrder.join(', ') : 'No current order found.';
        state = 'initial';
      } else if (message === '0') {
        state = 'cancel_order';
        response = 'Are you sure you want to cancel your order?';
        response += '\n\nSelect 1 to confirm cancellation\n';
        response += 'Select 0 to return to your order';
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
                + 'Select 1 to place a new order\n'
                + 'Select 98 to see order history\n'
                + 'Select 97 to see current order\n'
                + 'Select 0 to cancel';
      state = 'initial';
    } else {
      response = 'No order to checkout.';
      state = 'initial';
    }
  } else if (message === '0') {
    response = 'Your order has been cancelled.';
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
    currentOrder = [];
    state = 'initial';
  } else if (message === '0') {
    response = 'Your order has not been cancelled.';
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
