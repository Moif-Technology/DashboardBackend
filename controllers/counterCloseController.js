import mssql from "mssql";

import { connectToDashboard } from "../config/dbConfig.js";
import { checkExpiryStatus, getDbSchemaNameFromToken } from "./salesController.js";

export const getCounterCloseDetails = async (req, res) => {
    const {branchId} = req.query;
    console.log(branchId,"dfsfgdgdg");
    try {
      // Expiry check using the utility function
      const expiryCheck = checkExpiryStatus(req);
      if (expiryCheck.expired) {
        return res.status(403).json(expiryCheck);
      }
  
      // Extract dbSchemaName and stationId from token using the utility function
      const { dbSchemaName, stationId } = getDbSchemaNameFromToken(req);
  
      // Get branchId from the request query
      const branchId = req.query.branchId || stationId;  
     
  
      // Connect to the Dashboard database
      const dashboardPool = await connectToDashboard();
      const request = dashboardPool.request();
  
      // Query for counter close details filtered by StationID (branchId)
      const result = await request.query(`
         SELECT TOP(10)
          ID,
          CounterCloseID,
          CounterCloseCode,
          CONCAT(CounterCloseCode, CounterCloseNo) AS CounterCloseNo,
          CloseDate,
          FORMAT(CONVERT(DATETIME, CloseTime), 'dd-MM-yyyy hh:mm tt') AS CloseTime,
          CounterNo,
          StartBillNo,
          LastBillNo,
          TotalCash,
          TotalCredit,
          TotalCreditCard,
          TotalRefund,
          TotalDiscount,
          ReceiptAmount,
          VoucherAmount,
          PettyCash,
          BillCount,
          DiscCash,
          DiscCredit,
          DiscCreditCard,
          CashToBeCollected,
          CollectedCash,
          CashDifference,
          Remarks,
          CashierName,
          PostStatus,
          UploadStatus,
          StationID,
          CrBy,
          CrOn,
          ModBy,
          ModOn,
          ComplimentAmount,
          ServerStatus,
          SupervisorID,
          AdvanceAmount,
          ReceiptAmountCCard,
          ReceiptAmountCheque,
          TotalOnline
         FROM ${dbSchemaName}.CounterCloseDetails
        WHERE StationID = '${branchId}' ORDER BY ID DESC
        `);
        
       console.log(result.recordset);
      res.json(result.recordset); // Send the result back to the frontend
    } catch (error) {
      console.error('Error fetching counter close details:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };