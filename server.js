import express from 'express'
import routes from './src/routes/routes.js'
import bodyParser from 'body-parser'
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 43676;


app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json());

routes(app)

app.listen(PORT, () => {
    console.log(`you are server is running on ${PORT}`);
})
console.log('app running on port ', PORT);