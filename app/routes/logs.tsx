import { json, useLoaderData } from "@remix-run/react";
import { docClient, TABLE_NAME } from "~/lib/dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({}: LoaderFunctionArgs) {
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
      })
    );

    // Sort by timestamp (newest first)
    const logs = (result.Items || []).sort(
      (a: any, b: any) => b.timestamp - a.timestamp
    );

    return json({ logs, success: true });
  } catch (error) {
    console.error("Error fetching logs:", error);
    return json({
      logs: [],
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export default function Logs() {
  const { logs, success } = useLoaderData<typeof loader>();
  return (
    <div className="max-w-xl mx-auto p-6 bg-gray-50 rounded-lg shadow-md mt-10">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Manual Logger</h1>

      {/* Display logs */}
      <ul className="space-y-3">
        {logs.map((log, idx) => (
          <li
            key={idx}
            className="border-l-4 border-blue-500 bg-white p-3 rounded shadow-sm"
          >
            <span className="font-semibold text-gray-700">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>{" "}
            — <span className="text-gray-800">{log.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
