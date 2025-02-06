import { ApolloServer } from 'apollo-server-lambda';
import gql from 'graphql-tag';
import { GraphQLScalarType, Kind } from 'graphql';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';



dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const resolverDate = {
  Date: new GraphQLScalarType({
    name: 'Date',
    description: 'Date custom scalar type',
    parseValue(value) {
      return value;
    },
    serialize(value) {
      return value;
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.INT) {
        return ast.value;
      }
      return null;
    },
  }),
};

const typeDefs = gql`
  scalar Date
  type User {
    id: Int
    name: String
    email: String
    job_title: String
    joining_date: Date
    content: String
  }
  type Query {
    getUsers: [User]
    getUser(id: Int): User
  }
  type Mutation {
    updateUser(id: Int, name: String, email: String, job_title: String, joining_date: Date, content: String): Boolean
    createUser(name: String, email: String, job_title: String, joining_date: Date, content: String): Boolean
    deleteUser(id: Int): Boolean
  }
`;

const queryDB = async (sql, args = []) => {
  const connection = await mysql.createConnection(dbConfig);
  
  // Ensure 'args' is always an array
  if (!Array.isArray(args)) {
    args = [args];
  }

  const [rows] = await connection.execute(sql, args);
  await connection.end();
  return rows;
};


const resolvers = {
  ...resolverDate,
  Query: {
    getUsers: async () => await queryDB('SELECT * FROM users'),
    getUser: async (_, { id }) => {
      const result = await queryDB('SELECT * FROM users WHERE id = ?', [id]);
      return result[0];
    },
  },
  Mutation: {
    updateUser: async (_, args) => {
      const { id, ...updates } = args;
      
      // Convert updates object into a SQL SET string (e.g., "name = ?, email = ?")
      const updateFields = Object.keys(updates).map(field => `${field} = ?`).join(', ');
      const values = Object.values(updates);
    
      const result = await queryDB(`UPDATE users SET ${updateFields} WHERE id = ?`, [...values, id]);
      return result.affectedRows > 0;
    },
    createUser: async (_, args) => {
      const columns = Object.keys(args).join(', ');
      const placeholders = Object.keys(args).map(() => '?').join(', ');
      const values = Object.values(args);
    
      const sql = `INSERT INTO users (${columns}) VALUES (${placeholders})`;
      
      const result = await queryDB(sql, values);
      return result.affectedRows > 0;
    },
    deleteUser: async (_, { id }) => {
      const result = await queryDB('DELETE FROM users WHERE id = ?', [id]);
      return result.affectedRows > 0;
    },
  },
};

const server = new ApolloServer({ typeDefs, resolvers });

export const graphqlHandler = server.createHandler();
