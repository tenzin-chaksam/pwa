import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { docClient, TABLE_NAME } from "~/lib/dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

// This runs when form is submitted (SERVER-SIDE)
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const fieldValue = formData.get("fieldValue");

  // TODO: Save to DynamoDB here
  console.log("Form submitted:", fieldValue);
  try {
    // Create item to save
    const item = {
      id: crypto.randomUUID(), // Generate unique ID
      value: fieldValue,
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
    };

    // Save to DynamoDB
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

// This is your HOME PAGE (CLIENT-SIDE)
export default function Index() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Data Logger</h1>

        {/* The Form */}
        <Form method="post" className="space-y-4">
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
      </div>
    </div>
  );
}
