import mssql from "mssql";

// Base configuration for SQL Server
const dbConfig = {
  user: "sa",
  password: "gtarc",
  server: "20.244.45.211",
  options: {
    encrypt: false,
    enableArithAbort: true,
  },
  pool: {
    max: 10, // Maximum number of connections in the pool
    min: 0,  // Minimum number of connections in the pool
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  },
};

// Function to create a new pool for each database
const createDatabasePool = async (databaseName) => {
  try {
  
    const pool = new mssql.ConnectionPool({ ...dbConfig, database: databaseName });
    await pool.connect();
    console.log(`Successfully connected to the ${databaseName} SQL Server`);
    return pool;
  } catch (err) {
    console.error(`Failed to connect to the ${databaseName} database:`, err);
    throw err;
  }
};

// Specific functions to connect to each database
export const connectToDashboard = () => createDatabasePool("DashBoard");
export const connectToCompanyDetails = () => createDatabasePool("DashBoardCompanyDetails");
