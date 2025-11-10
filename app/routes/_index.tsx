import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { docClient, TABLE_NAME } from "~/lib/dynamodb";
import { PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { useEffect, useRef } from "react";
import { registerServiceWorker } from "utils/registerServiceWorkers";

// SERVER-SIDE: Fetch logs when page loads
export async function loader({}: LoaderFunctionArgs) {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": "LOGS",
        },
        ScanIndexForward: false,
        Limit: 3,
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

// SERVER-SIDE: Save new log when form is submitted
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const fieldValue = formData.get("fieldValue");

  if (!fieldValue || typeof fieldValue !== "string") {
    return json(
      { success: false, message: "Please enter a value" },
      { status: 400 }
    );
  }

  try {
    const item = {
      pk: "LOGS",
      value: fieldValue,
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    );

    console.log("✅ Saved to DynamoDB:", item);

    return json({
      success: true,
      message: "Data saved to DynamoDB!",
      item: item,
    });
  } catch (error) {
    console.error("❌ DynamoDB Error:", error);

    return json(
      {
        success: false,
        message: "Failed to save data. Check your AWS credentials.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// CLIENT-SIDE: Display form and logs
export default function Index() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  const { logs, success } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const formRef = useRef<HTMLFormElement>(null);

  // Reset form when submission is successful
  useEffect(() => {
    if (actionData?.success) {
      formRef.current?.reset();
    }
  }, [actionData?.success]);
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Form Section */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Data Logger</h1>

          <Form method="post" className="space-y-4" ref={formRef}>
            <div>
              <label
                htmlFor="fieldValue"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Enter Data
              </label>
              <input
                type="text"
                id="fieldValue"
                name="fieldValue"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Type something..."
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Submit
            </button>
          </Form>

          {/* Success Message */}
          {actionData?.success && (
            <div className="mt-4 p-4 bg-green-100 text-green-700 rounded-lg">
              {actionData.message}
            </div>
          )}

          {/* Error Message from Action */}
          {actionData?.success === false && (
            <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-lg">
              {actionData.message}
            </div>
          )}
        </div>

        {/* Logs Section */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Recent Logs</h2>

          {/* No logs */}
          {success && logs.length === 0 && (
            <p className="text-gray-500">
              No logs yet. Add your first log above!
            </p>
          )}

          {/* Display logs */}
          {success && logs.length > 0 && (
            <ul className="space-y-3">
              {logs.map((log: any) => (
                <li
                  key={log.pk + log.timestamp}
                  className="border-l-4 border-blue-500 bg-gray-50 p-4 rounded shadow-sm"
                >
                  <span className="font-semibold text-gray-700">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>{" "}
                  — <span className="text-gray-800">{log.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
