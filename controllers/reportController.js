import { connectToDashboard } from "../config/dbConfig.js";
import { checkExpiryStatus, getDbSchemaNameFromToken } from "./salesController.js";

// Controller: Get Group Names and Item Sale Report
export const getItemSaleReport = async (req, res) => {
  try {
    // Step 1: Check if the token has expired
    const expiryCheck = checkExpiryStatus(req);
    if (expiryCheck.expired) {
      return res.status(403).json(expiryCheck);
    }

    // Step 2: Extract dbSchemaName and stationId from the token
    const { dbSchemaName, stationId } = getDbSchemaNameFromToken(req);

    // Step 3: Extract query parameters (branchId, fromDate, toDate, groupName)
    const { branchId, fromDate, toDate, groupName } = req.query;
    const selectedBranchId = branchId || stationId; // Use passed branchId or fallback to stationId
    
console.log(req.query,"item report");

    // Step 4: Fetch Group Names associated with the branch
    const dashboardPool = await connectToDashboard();
    const request = dashboardPool.request();

    // Declare the BranchID parameter only once
    request.input('BranchID', selectedBranchId);

    const groupQuery = `
      SELECT
        GroupName
      FROM
        ${dbSchemaName}.SalesChild
      WHERE
        StationID = @BranchID
      GROUP BY
        GroupName
    `;
    
 

    // Execute the group query
    const groupResult = await request.query(groupQuery);
    const groupNames = groupResult.recordset.map(record => record.GroupName);

    if (groupNames.length === 0) {
      console.log('No group names found for the selected BranchID.');
    } else {
      console.log('Group names found:', groupNames);
    }

    // Step 5: Fetch the item sale report, optionally filter by groupName
    let itemSaleReport = [];

    if (fromDate && toDate) {
      const formattedFromDate = `${fromDate} 05:00:00 AM`; // Assuming fromDate is in 'YYYY-MM-DD' format
      const formattedToDate = `${toDate} 05:00:00 AM`; // Assuming toDate is in 'YYYY-MM-DD' format

console.log(formattedFromDate);
console.log(formattedToDate);
console.log(branchId);

      // Base SQL query for the report
      let reportQuery = `
        SELECT 
          ShortDescription, 
          GroupName, 
          SUM(Qty) AS Qty, 
          ROUND(SUM(LineTotal), 2) AS TotalAmount
        FROM 
          ${dbSchemaName}.SalesChild sc
        JOIN 
          ${dbSchemaName}.SalesMaster sm ON sc.SalesID = sm.SalesID
        WHERE 
          sc.LineTotal <> 0 
          AND sm.BillTime > @FromDate 
          AND sm.BillTime < @ToDate 
          AND sc.StationID = @BranchID
      `;

      // If groupName is provided, add the groupName filter
      if (groupName) {
        reportQuery += ` AND sc.GroupName = @GroupName`; // Add GroupName filter
        request.input('GroupName', groupName); // Add GroupName parameter to the request
        console.log('GroupName:', groupName);
      }
console.log(groupName);
      console.log(reportQuery,"Report query");

      // Add GROUP BY clause to the query
      reportQuery += `
        GROUP BY 
          ShortDescription, GroupName
      `;

      // Prepare SQL request inputs
      request.input('FromDate', formattedFromDate).input('ToDate', formattedToDate);

      // Execute the report query
      const reportResult = await request.query(reportQuery);
      itemSaleReport = reportResult.recordset;
    }

    // Step 6: Return the group names and the item sale report (if applicable)
    res.status(200).json({
      groupNames, // Send the group names to the frontend
      data: itemSaleReport, // Send the item sale report (if available)
      message: "Group names and item sale report fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching group names and item sale report:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getGroupReport = async (req, res) => {
    try {
      // Step 1: Check if the token has expired
      const expiryCheck = checkExpiryStatus(req);
      if (expiryCheck.expired) {
        return res.status(403).json(expiryCheck);
      }
  
      // Step 2: Extract dbSchemaName and stationId from the token
      const { dbSchemaName, stationId } = getDbSchemaNameFromToken(req);
  
      // Step 3: Extract query parameters (branchId, fromDate, toDate)
      const { branchId, fromDate, toDate } = req.query;
      const selectedBranchId = branchId || stationId; // Use passed branchId or fallback to stationId
      console.log(req.query,"Group report");
  
      // Step 4: Validate the input dates
      if (!fromDate || !toDate) {
        return res.status(400).json({ message: "From date and To date are required" });
      }
  
      const formattedFromDate = `${fromDate} 05:00:00 AM`; // Assuming fromDate is in 'YYYY-MM-DD' format
      const formattedToDate = `${toDate} 05:00:00 AM`; // Assuming toDate is in 'YYYY-MM-DD' format
  
      // Step 5: Connect to the dashboard database
      const dashboardPool = await connectToDashboard();
      const request = dashboardPool.request();
  
      // Step 6: SQL Query to get aggregated group sales report
      const query = `
        SELECT 
          GroupName, 
          SUM(Qty) AS TotalQty, 
          ROUND(SUM(LineTotal), 2) AS TotalAmount
        FROM 
          ${dbSchemaName}.SalesChild sc
        JOIN 
          ${dbSchemaName}.SalesMaster sm ON sc.SalesID = sm.SalesID
        WHERE 
          sc.LineTotal <> 0 
          AND sm.BillTime > @FromDate 
          AND sm.BillTime < @ToDate 
          AND sc.StationID = @BranchID
        GROUP BY 
          GroupName
      `;
  
      console.log(`
        SELECT 
          GroupName, 
          SUM(Qty) AS TotalQty, 
          ROUND(SUM(LineTotal), 2) AS TotalAmount
        FROM 
          ${dbSchemaName}.SalesChild sc
        JOIN 
          ${dbSchemaName}.SalesMaster sm ON sc.SalesID = sm.SalesID
        WHERE 
          sc.LineTotal <> 0 
          AND sm.BillTime > @FromDate 
          AND sm.BillTime < @ToDate 
          AND sc.StationID = @BranchID
        GROUP BY 
          GroupName
      `);
      const result = await request
        .input('FromDate', formattedFromDate)
        .input('ToDate', formattedToDate)
        .input('BranchID', selectedBranchId)
        .query(query);
  
      // Step 7: Return the aggregated data
      const groupSalesReport = result.recordset;
      res.status(200).json({
        data: groupSalesReport,
        message: "Group sales report fetched successfully",
      });
    } catch (error) {
      console.error("Error fetching group sales report:", error);
      res.status(500).json({ message: "Server error" });
    }
  };