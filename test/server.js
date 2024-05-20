require("dotenv").config();
const mongoose = require("mongoose");

const { ApolloServer } = require("@apollo/server");
const { startStandaloneServer } = require("@apollo/server/standalone");
const path = require("path");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { mergeResolvers } = require("@graphql-tools/merge");
const { loadFilesSync } = require("@graphql-tools/load-files");
const { loadSchemaSync } = require("@graphql-tools/load");
const { GraphQLFileLoader } = require("@graphql-tools/graphql-file-loader");

const typeDefs = loadSchemaSync("./**/**/**/*.graphql", {
  loaders: [new GraphQLFileLoader()],
});
const resolverFiles = loadFilesSync(
  path.join(__dirname, "./**/**/**/*.resolver.*")
);
const resolvers = mergeResolvers(resolverFiles);

const schema = makeExecutableSchema({ typeDefs, resolvers });

// mongoose
// .connect(process.env.MONGO_URI)   // Localhost - "mongodb://127.0.0.1/lucky"
// // .connect(process.env.MONGO_URL)   // Mogodb atlas
// .then((result) => {
//     // app.listen(8080); // localhost:8080
//     console.log("Sucessfully connected to mongodb Atlas");
//   })
//   .catch((err) => console.log(err));

// This function will create a new server Apollo Server instance
const createApolloServer = async () => {
  const server = new ApolloServer({ schema, resolvers });

  const { url } = await startStandaloneServer(server, {
    listen: { port: 8080 },
  });

  // return the server instance and the url the server is listening on
  return { server, url };
};

module.exports = createApolloServer;

// // For simplicity we create our server in this file,
// // but in a real app you'd export `createApolloServer` into
// // another file and call it elsewhere.
// if (process.env.NODE_ENV !== 'test') {
//   const { url } = await createApolloServer();
//   console.log(`🚀 Query endpoint ready at ${url}`);
// }
