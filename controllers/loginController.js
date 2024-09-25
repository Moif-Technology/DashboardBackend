import mssql from "mssql";
import { connectToCompanyDetails } from "../config/dbConfig.js";
import { generateToken, verifyToken } from "../config/auth.js";

export const login = async (req, res) => {
  const { username, password } = req.body;
 

  try {
    // Step 1: Connect to the CompanyDetails database
    const sql = await connectToCompanyDetails();

    // Step 2: Retrieve user details and validate credentials
    const userResult = await sql
      .request()
      .input("Login", mssql.VarChar, username)
      .query(`
        SELECT CompanyID, StationID, SystemRoleID, Password 
        FROM DashBoardCompanyDetails.dbo.UserLog 
        WHERE Login = @Login
      `);

    if (userResult.recordset.length === 0 || password !== userResult.recordset[0].Password) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const { CompanyID, StationID, SystemRoleID } = userResult.recordset[0];


    // Step 3: Fetch company, branch details, and branch list in parallel
    const [companyResult, branchResult, branchesListResult] = await Promise.all([
      sql.request().input("CompanyID", mssql.VarChar, CompanyID)
        .query(`
          SELECT CompanyName, DbSchemaName 
          FROM DashBoardCompanyDetails.dbo.CompanyLog 
          WHERE CompanyID = @CompanyID
        `),
      sql.request().input("CompanyID", mssql.VarChar, CompanyID)
        .input("BranchID", mssql.VarChar, StationID)
        
        .query(`
          SELECT BranchName, ExpiryDate, ExpiryStatus 
          FROM DashBoardCompanyDetails.dbo.Branch_Log 
          WHERE CompanyID = @CompanyID AND BranchID = @BranchID
        `),
     
      sql.request().input("CompanyID", mssql.VarChar, CompanyID)
        .query(`
          SELECT BranchID, BranchName 
          FROM DashBoardCompanyDetails.dbo.Branch_Log 
          WHERE CompanyID = @CompanyID AND ExpiryStatus = 0
        `)
    ]);

    if (companyResult.recordset.length === 0) {
      return res.status(404).json({ message: "Company not found" });
    }

    if (branchResult.recordset.length === 0) {
      // Even if no specific branch is found, allow login
      console.log("No branch found for the StationID, proceeding with login");
    }

    const { CompanyName, DbSchemaName } = companyResult.recordset[0];
    let { BranchName, ExpiryDate, ExpiryStatus } = branchResult.recordset[0] || {};
    
    const branchesList = branchesListResult.recordset;

    // Check if DbSchemaName is undefined or null
    if (!DbSchemaName) {
      return res.status(500).json({ message: "Invalid dbSchemaName. Please check the configuration." });
    }

    // Step 4: Perform Expiry Check and update ExpiryStatus if needed
    const currentDate = new Date();
    ExpiryDate = ExpiryDate ? new Date(ExpiryDate) : null;

    if (ExpiryDate && ExpiryDate < currentDate && ExpiryStatus !== 1) {
      await sql.request()
        .input("CompanyID", mssql.VarChar, CompanyID)
        .input("BranchID", mssql.VarChar, StationID)
        .query(`
          UPDATE DashBoardCompanyDetails.dbo.Branch_Log 
          SET ExpiryStatus = 1 
          WHERE CompanyID = @CompanyID AND BranchID = @BranchID
        `);
      ExpiryStatus = 0;
    }
  
    // Generate JWT Token
    const token = generateToken({
      username,
      CompanyID,
      CompanyName,
      DbSchemaName,
      StationID,
      SystemRoleID,
      BranchName: BranchName, // Default if no branch name is found
      ExpiryStatus: ExpiryStatus, // Default to not expired
      ExpiryDate: ExpiryDate ? ExpiryDate.toISOString() : null,
    });

    // Respond with the token and additional user details
    res.json({
      token,
      CompanyID,
      CompanyName,
      DbSchemaName,
      StationID,
      SystemRoleID,
      BranchName: BranchName || "N/A",
      ExpiryStatus: ExpiryStatus || 1,
      ExpiryDate: ExpiryDate ? ExpiryDate.toISOString() : null,
      branches: branchesList.length > 1 ? branchesList : [] // Only include branches if more than one exists
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ message: "Authorization token is missing" });
    }

    // Verify the token
    // const decodedToken = verifyToken(token);

    // if (!decodedToken) {
    //   return res.status(401).json({ message: "Invalid token" });
    // }

    console.log(`User logged out successfully`);

    // Since no token storage is involved, just respond with success
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
