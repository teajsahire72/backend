import express   from 'express';
import http  from 'http';
import  { graphqlHTTP } from 'express-graphql';
import { GraphQLScalarType, Kind, buildSchema } from 'graphql';
import mysql from 'mysql2';
import cors from 'cors';

let con = {};
const app = express();
app.use(express.json({ limit: '16mb' }))
app.use(cors());

  const resolverDate = {
  Date: new GraphQLScalarType({
    name: 'Date',
    description: 'Date custom scalar type',
    parseValue(value) {
      return value; // value from the client
    },
    serialize(value) {
      return value; // value sent to the client
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.INT) {
        return ast.value // ast value is always in string format
      }
      return null;
    },
  }),
};

const schema = buildSchema(`
  scalar Date
  type User {
    id: Int
    name: String
    email: String
    job_title: String
    joining_date:Date
    content:String
  }
  type Query {
    getUsers: [User],
    getUser(id: Int):User
    }
  type Mutation {
    updateUser(id: Int, name: String, email: String, job_title: String, 
      joining_date:Date, content:String): Boolean,
    createUser(name: String, email: String, job_title: String, joining_date:Date, 
      content:String): Boolean,
    deleteUser(id: Int): Boolean
  }
`);

con = mysql.createConnection({
  host     : '127.0.0.1',
  user     : 'root',
  password : 'root',
  database : 'userapp'
});

con.connect((err) => {
  if (err) {
    console.log('Error connecting to database:'+err);
    return;
  }
  console.log('Connected to database');
});

app.use((req, res, next) => {
  req.mysqlDb = con;
  next();
});

const queryDB = (req, sql, args) => new Promise((resolve, reject) => {
  req.mysqlDb.query(sql, args, (err, rows) => {
      if (err) return reject(err);
      rows.changedRows || rows.affectedRows || rows.insertId ? resolve(true) : resolve(rows);
  });
});  

const root = {
  getUsers: (args, req) => queryDB(req, "select * from users").then(data => data),
  getUser: (args, req) => queryDB(req, "select * from users where id = ?", [args.id]).then(data => data[0]),
  updateUser: (args, req) => queryDB(req, "update users SET ? where id = ?", [args, args.id]).then(data => data),
  createUser: (args, req) => queryDB(req, "insert into users SET ?", args).then(data => data),
  deleteUser: (args, req) => queryDB(req, "delete from users where id = ?", [args.id]).then(data => data),
};

let users = [
  { id: 1, name: 'John Doe', age: 30 },
  { id: 2, name: 'Jane Smith', age: 25 }
];

// GET endpoint to fetch all users
app.get('/api/users', (req, res) => {
  res.json(users);
});

app.use('/graphql', graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true,
}));


const httpServer = http.createServer(app);
httpServer.listen('4000');
console.log('Running a GraphQL API server 🚀 at localhost:4000/graphql'); 
