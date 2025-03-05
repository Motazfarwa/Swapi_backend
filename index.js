const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Import the cors middleware
const swapirouter = require('./services/Swapiservice');
const path = require('path'); // Import the cors middleware



const app = express();

app.use(bodyParser.json());
app.use(cors({
    origin: 'http://localhost:3000'
  }));
  
app.use('/ajouter', swapirouter);
// Serve static files from "uploads" folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
