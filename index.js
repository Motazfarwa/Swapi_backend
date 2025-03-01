const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Import the cors middleware
const swapirouter = require('./services/Swapiservice');



const app = express();

app.use(bodyParser.json());
app.use(cors({
    origin: 'http://localhost:3000'
  }));
  
app.use('/ajouter', swapirouter);



const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
