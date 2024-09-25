import { connectToDashboard } from "../config/dbConfig.js";
import { verifyToken } from "../config/auth.js";

export const getCountOfUniqueCustomers = async (req, res) => {
  const { date, branchId } = req.query; // Accept branchId as a query parameter

  // Parse the date and set the time range from 5 AM today to 5 AM the next day
  const selectedDate = new Date(date);
  const startDate = new Date(selectedDate);
  startDate.setHours(5, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 1);
  endDate.setHours(5, 0, 0, 0);

  try {
    // Verify token and extract schema name and station ID
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      throw new Error('Token not provided');
    }

    const decodedToken = verifyToken(token);
    const dbSchemaName = decodedToken?.DbSchemaName;
    const stationId = decodedToken?.StationID; // Extract stationId from token

    if (!dbSchemaName) {
      console.error('dbSchemaName is undefined!');
      return res.status(500).json({ message: 'Database schema name is undefined.' });
    }

    // Use the passed branchId or fallback to stationId from the token
    const selectedBranchId = branchId || stationId;

    // Connect to the DashBoard database
    const dashboardPool = await connectToDashboard();
    const request = dashboardPool.request();

    // Use parameterized queries to avoid SQL injection and handle dates more safely
    const query = `
      SELECT COUNT(DISTINCT CustomerID) AS totalCustomers
      FROM ${dbSchemaName}.SalesMaster
      WHERE BillTime >= @startDate AND BillTime < @endDate
        AND StationID = @selectedBranchId -- Filter by stationId or branchId
    `;

    // Execute the query with the date and branchId as inputs
    const countResult = await request
      .input('startDate', startDate)
      .input('endDate', endDate)
      .input('selectedBranchId', selectedBranchId)
      .query(query);

    // Send the result
    res.status(200).json({
      totalCustomers: countResult.recordset[0]?.totalCustomers || 0
    });
  } catch (err) {
    console.error('SQL error', err);
    res.status(500).send('Server Error');
  }
};
