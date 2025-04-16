import mssql from "mssql";
import { generateToken } from "../config/auth.js";
import { connectToCompanyDetails } from "../config/dbConfig.js";

export const login = async (req, res) => {
  console.log("Ivide veruunnod******");
  const { username, password } = req.body; // This is the login username
  console.log(req.body,"Ith vanno??");
  try {
    console.log("itheel keriyo?");
    // Step 1: Connect to the CompanyDetails database
    const sql = await connectToCompanyDetails();

    // Step 2: Retrieve user details and validate credentials
    const userResult = await sql
      .request()
      .input("Login", mssql.VarChar, username) // Use the login username for DB query
      .query(`
        SELECT CompanyID, UserName, StationID, SystemRoleID, Password 
        FROM DashBoardCompanyDetails.dbo.UserLog 
        WHERE Login = @Login
      `);

    if (userResult.recordset.length === 0 || password !== userResult.recordset[0].Password) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const { CompanyID, StationID, SystemRoleID, UserName } = userResult.recordset[0]; // This is the display UserName

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

    const { CompanyName, DbSchemaName } = companyResult.recordset[0];
    let { BranchName, ExpiryDate, ExpiryStatus } = branchResult.recordset[0] || {};
    
    const branchesList = branchesListResult.recordset;

    // Step 4: Perform Expiry Check
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

    // Step 5: Generate JWT Token
    const token = generateToken({
      username, // Login username (this is passed in the request)
      CompanyID,
      CompanyName,
      UserName, // This is the display username retrieved from the DB
      DbSchemaName,
      StationID,
      SystemRoleID,
      BranchName: BranchName || "N/A",
      ExpiryStatus: ExpiryStatus || 1,
      ExpiryDate: ExpiryDate ? ExpiryDate.toISOString() : null,
    });

    // Respond with the token and additional user details
    res.json({
      token,
      CompanyID,
      CompanyName,
      UserName, // Displayed username
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


export const updatePassword = async (req, res) => {
  const { username, newPassword } = req.body; // Get the username and new password from the request body
console.log(req.body);
  if (!username || !newPassword) {
    return res.status(400).json({ message: "Username and new password are required" });
  }

  try {
    // Step 1: Connect to the CompanyDetails database
    const sql = await connectToCompanyDetails();

    // Step 2: Check if the user exists in the UserLog table
    const userResult = await sql
      .request()
      .input("Login", mssql.VarChar, username)
      .query(`
        SELECT UserName
        FROM DashBoardCompanyDetails.dbo.UserLog 
        WHERE Login = @Login
      `);

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Step 3: Update the password in the UserLog table
    await sql
      .request()
      .input("Login", mssql.VarChar, username)
      .input("NewPassword", mssql.VarChar, newPassword)
      .query(`
        UPDATE DashBoardCompanyDetails.dbo.UserLog 
        SET Password = @NewPassword 
        WHERE Login = @Login
      `);
console.log("Change aayo?");
    // Step 4: Respond with success
    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Logout Controller
export const logout = (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Authorization token is missing" });
    }

    console.log(`User logged out successfully`);
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
