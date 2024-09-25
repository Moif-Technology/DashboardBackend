import mssql from "mssql";
import {
  connectToCompanyDetails,
  connectToDashboard,
} from "../config/dbConfig.js";
import { verifyToken } from "../config/auth.js";

// Function to fetch dbSchemaName, stationId, branchId, and branchName from the token
 export const getDbSchemaNameFromToken = (req) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    throw new Error("Token not provided");
  }

  // Decode the token and log the output
  const decodedToken = verifyToken(token);


  return {
    dbSchemaName: decodedToken.DbSchemaName,
    stationId: decodedToken.StationID,
    systemRoleId: decodedToken.SystemRoleID,
    branchId: decodedToken.StationID,
    branchName: decodedToken.BranchName,
    CompanyID: decodedToken.CompanyID,
  };
};

// Expiry check function (unchanged)
export const checkExpiryStatus = (req) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return { expired: true, message: "Token not provided" };
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    console.log("Token missing in Authorization header");
    return { expired: true, message: "Token not provided" };
  }

  try {
    const decodedToken = verifyToken(token);

    const expiryStatus = decodedToken.ExpiryStatus;
    
    const expiryDate = new Date(decodedToken.ExpiryDate);
  
    const currentDate = new Date();

    if (expiryStatus === 1 || expiryDate < currentDate) {
      return { expired: true, message: "Company subscription has expired." };
    }

    return { expired: false };
  } catch (error) {
    console.error("Error verifying token:", error.message);
    return { expired: true, message: "Invalid or expired token" };
  }
};

export const getBranches = async (req, res) => {
    try {
      console.log("Controller initiated");
  
      // Extract relevant details from the token
      const { CompanyID, systemRoleId: role, branchId, branchName } = getDbSchemaNameFromToken(req);
      console.log("Extracted from token:", { CompanyID, role, branchId, branchName });
  
      if (!CompanyID) {
        console.log("Company ID is missing in the token");
        return res.status(400).json({ message: "Company ID not found in token" });
      }
  
      const systemRoleId = parseInt(role); // Ensure systemRoleId is an integer
  
      if (isNaN(systemRoleId)) {
        console.log("System Role ID is invalid or missing");
        return res.status(400).json({ message: "System Role ID is invalid" });
      }
  
      // Connect to the CompanyDetails database
      const companyDetailsPool = await connectToCompanyDetails();
      console.log("Database connection successful");
  
      const request = companyDetailsPool.request();
  
      let branchesQuery;
      let queryParams = { CompanyID };
  
      if (systemRoleId === 1) {
        console.log("System Role is 1: Fetching all branches");
        // If systemRoleId is 1, fetch all branches
        branchesQuery = `
          SELECT BranchID, BranchName 
          FROM DashBoardCompanyDetails.dbo.Branch_Log 
          WHERE CompanyID = @CompanyID AND ExpiryStatus = 0
        `;
      } else if (systemRoleId === 0) {
        console.log("System Role is 0: Fetching the specific branch based on the token");
        // If systemRoleId is 0, fetch only the branch that is in the token
        branchesQuery = `
          SELECT BranchID, BranchName 
          FROM DashBoardCompanyDetails.dbo.Branch_Log 
          WHERE CompanyID = @CompanyID AND BranchID = @BranchID AND ExpiryStatus = 0
        `;
        queryParams = { ...queryParams, BranchID: branchId };
      } else {
        console.log("Unhandled systemRoleId: Returning empty branches");
        return res.json({ branches: [] });
      }
  
      // Log the query and parameters
      console.log("Executing query:", branchesQuery);
      console.log("Query parameters:", queryParams);
  
      // Execute the query
      const result = await request
        .input("CompanyID", mssql.VarChar, queryParams.CompanyID)
        .input("BranchID", mssql.VarChar, queryParams.BranchID || null)
        .query(branchesQuery);
  
      console.log("Query executed successfully. Result:", result.recordset);
  
      const branchesList = result.recordset;
  
      // Respond with the branch list
      res.json({
        branches: branchesList.length > 0 ? branchesList : [],
      });
    } catch (error) {
      console.error("Error fetching branches:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
  
  
// Controller: Get Sales Details with stationId/branchId filter
export const getSalesDetails = async (req, res) => {
  const { date, branchId } = req.query;
console.log(branchId,"ith sales");
  const expiryCheck = checkExpiryStatus(req);

  if (expiryCheck.expired) {
    return res.status(403).json(expiryCheck);
  }

  const selectedDate = new Date(date);
  const startDate = new Date(selectedDate);
  startDate.setHours(5, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 1);
  endDate.setHours(5, 0, 0, 0);

  const formattedStartDate = `${
    startDate.toISOString().split("T")[0]
  } 05:00:00 AM`;
  const formattedEndDate = `${endDate.toISOString().split("T")[0]} 05:00:00 AM`;

  try {
    const { dbSchemaName, stationId } = getDbSchemaNameFromToken(req);
    // console.log(dbSchemaName,stationId,"ith veruundo?");
    const selectedBranchId = branchId || stationId; // Use the passed branchId or fallback to stationId

    const dashboardPool = await connectToDashboard();
    const request = dashboardPool.request();

    const result = await request.query(`
            SELECT 
                COUNT(*) AS totalSalesCount,
                COUNT(CASE WHEN Amount < 0 THEN 1 END) AS positiveAmountSalesCount,
                SUM(CashAmount) AS totalCashAmount,
                SUM(CreditAmount) AS totalCreditAmount,
                SUM(CreditCardAmount) AS totalCreditCardAmount
            FROM ${dbSchemaName}.SalesMaster
            WHERE BillTime >= '${formattedStartDate}' 
              AND BillTime < '${formattedEndDate}'
              AND StationID = '${selectedBranchId}'  -- Filter by stationId or branchId
        `);

    const {
      totalSalesCount,
      positiveAmountSalesCount,
      totalCashAmount,
      totalCreditAmount,
      totalCreditCardAmount,
    } = result.recordset[0];

    res.json({
      totalSalesCount,
      positiveAmountSalesCount,
      totalCashAmount,
      totalCreditAmount,
      totalCreditCardAmount,
    });
  } catch (err) {
    console.log(err);
    console.error("SQL error", err);
    res.status(500).send("Server Error");
  }
};

// Controller: Get Monthly Sales with stationId/branchId filter
export const getMonthlySales = async (req, res) => {
  const { branchId } = req.query; // Accept branchId as a query parameter
  const expiryCheck = checkExpiryStatus(req);
  if (expiryCheck.expired) {
    return res.status(403).json(expiryCheck);
  }

  try {
    const year = 2024;
    const { dbSchemaName, stationId } = getDbSchemaNameFromToken(req);
    const selectedBranchId = branchId || stationId; // Use the passed branchId or fallback to stationId

    const dashboardPool = await connectToDashboard();
    const request = dashboardPool.request();
    // console.log(dashboardPool);
    // console.log("222");
    const result = await request.query(`
            SELECT 
                YEAR(billdate) AS Year,
                MONTH(billdate) AS Month,
                SUM(amount) AS TotalAmount
            FROM 
                ${dbSchemaName}.SalesMaster
            WHERE 
                YEAR(billdate) = ${year}
              AND StationID = '${selectedBranchId}'  -- Filter by stationId or branchId
            GROUP BY 
                YEAR(billdate), 
                MONTH(billdate)
            ORDER BY 
                Month
        `);
    // console.log(dashboardPool);
    // console.log(`
    //     SELECT
    //         YEAR(billdate) AS Year,
    //         MONTH(billdate) AS Month,
    //         SUM(amount) AS TotalAmount
    //     FROM
    //         ${dbSchemaName}.SalesMaster
    //     WHERE
    //         YEAR(billdate) = ${year}
    //       AND StationID = '${selectedBranchId}'  -- Filter by stationId or branchId
    //     GROUP BY
    //         YEAR(billdate),
    //         MONTH(billdate)
    //     ORDER BY
    //         Month
    // `,"Year quer?");

    const data = result.recordset;
    const formattedData = [];

    for (let month = 1; month <= 12; month++) {
      const found = data.find((d) => d.Month === month);
      formattedData.push({
        Year: year,
        Month: month,
        TotalAmount: found ? found.TotalAmount : 0,
      });
    }

    res.status(200).json(formattedData);
  } catch (err) {
    console.log(err, "error");
    console.error("SQL error", err);
    res.status(500).send("Server Error");
  }
};

// Controller: Get Area Sales with stationId/branchId filter
export const getAreaSales = async (req, res) => {
  const { date, branchId } = req.query; // Accept branchId as a query parameter
  console.log(date, branchId);
  const expiryCheck = checkExpiryStatus(req);
  if (expiryCheck.expired) {
    return res.status(403).json(expiryCheck);
  }

  const selectedDate = new Date(date);
  const startDate = new Date(selectedDate);
  startDate.setHours(5, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 1);
  endDate.setHours(5, 0, 0, 0);

  const formattedStartDate = `${
    startDate.toISOString().split("T")[0]
  } 05:00:00 AM`;
  const formattedEndDate = `${endDate.toISOString().split("T")[0]} 05:00:00 AM`;

  try {
    const { dbSchemaName, stationId } = getDbSchemaNameFromToken(req);
    const selectedBranchId = branchId || stationId; // Use the passed branchId or fallback to stationId

    const dashboardPool = await connectToDashboard();
    const request = dashboardPool.request();

    // Querying directly from SalesMaster for area data
    // console.log("333");
    const result = await request.query(`
            SELECT 
                AreaID,
                AreaName,
                SUM(CashAmount + CreditAmount + CreditCardAmount) AS TotalSales
            FROM 
                ${dbSchemaName}.SalesMaster
            WHERE 
                (CashAmount > 0 OR CreditAmount > 0 OR CreditCardAmount > 0)
                AND BillTime >= '${formattedStartDate}' 
                AND BillTime < '${formattedEndDate}'
                AND StationID = '${selectedBranchId}'  -- Filter by stationId or branchId
            GROUP BY 
                AreaID, AreaName
        `);
console.log(`
            SELECT 
                AreaID,
                AreaName,
                SUM(CashAmount + CreditAmount + CreditCardAmount) AS TotalSales
            FROM 
                ${dbSchemaName}.SalesMaster
            WHERE 
                (CashAmount > 0 OR CreditAmount > 0 OR CreditCardAmount > 0)
                AND BillTime >= '${formattedStartDate}' 
                AND BillTime < '${formattedEndDate}'
                AND StationID = '${selectedBranchId}'  -- Filter by stationId or branchId
            GROUP BY 
                AreaID, AreaName
        `);
        const areaSalesData = result.recordset.map((record) => ({
          areaId: record.AreaID,
          areaName: record.AreaName,
          totalSales: record.TotalSales,
        }));
        console.log(areaSalesData);
    res.json(areaSalesData);
  } catch (err) {
    console.error("SQL error", err);
    res.status(500).send("Server Error");
  }
};
