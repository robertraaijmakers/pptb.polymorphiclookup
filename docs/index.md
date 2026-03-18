# Polymorphic Lookup

Polymorphic Lookup is a Power Platform ToolBox (PPTB) tool for creating and managing Dataverse polymorphic lookup columns.

A polymorphic lookup is a single lookup column that can reference multiple target tables.

## Who this tool is for

Use this tool when you want to:
- add a new polymorphic lookup column to a table,
- change which target tables an existing polymorphic lookup can reference,
- update lookup metadata,
- or delete an existing polymorphic lookup attribute.

## Prerequisites

- Access to a Dataverse environment through PPTB
- Permissions to customize tables/columns and publish customizations
- An unmanaged solution (for organizing your changes)

## Main workflow

1. Open the tool and connect to your Dataverse environment.
2. Select an unmanaged **Solution**.
3. Select a **Table** from that solution.
4. Select an **Attribute**:
   - **Create new lookup** to create a new polymorphic lookup
   - an existing polymorphic lookup to update or delete

The tool shows a busy indicator while loading or applying operations.

---

## Create a new polymorphic lookup

1. In **Attribute**, choose **Create new lookup**.
2. Enter:
   - **Lookup display name**
   - **Lookup schema name** (suffix; publisher prefix is shown automatically)
   - optional **Description**
   - **Required Level**
3. Select one or more **Referenced tables**.
4. Click **Create lookup**.

What happens:
- The tool creates the polymorphic lookup attribute.
- Target relationships are created from your selected referenced tables.
- Customizations are published.

---

## Update an existing polymorphic lookup

1. Select an existing lookup in **Attribute**.
2. Change metadata as needed:
   - Display name
   - Description
   - Required level
3. Update **Referenced tables**:
   - add new tables,
   - remove tables that should no longer be targets.
4. Click **Update lookup**.

What happens:
- Metadata is updated.
- Added/removed target relationships are applied.
- Customizations are published.

---

## Delete a polymorphic lookup (full attribute delete)

1. Select an existing lookup in **Attribute**.
2. Click **Delete lookup**.
3. Confirm the prompt.

What happens:
- The full lookup attribute is deleted from the table.
- Customizations are published.

> **Warning:** This is destructive. Deleting a lookup removes the attribute and its references.

---

## UI behavior and guardrails

- **Schema name** is only editable when creating a new lookup.
- In update mode, the tool compares current vs selected target tables and applies only the delta.
- Action buttons are disabled when required input is missing.
- A busy indicator shows when the tool is executing an operation.

## Troubleshooting

### Not connected
- Select an active Dataverse connection in PPTB.
- Reopen the tool if needed.

### No tables in solution
- Verify the selected solution is unmanaged.
- Verify the solution contains table components.

### Operation fails
- Check the **Activity** log panel for details.
- Confirm your account has metadata customization and publish permissions.
- Retry after refreshing the selected table/attribute.

### Changes do not appear
- Confirm publish completed successfully.
- Refresh metadata in your Dataverse app or maker portal.

## Support

If you find an issue or want to suggest an improvement, open a GitHub issue in this repository.
