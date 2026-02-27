# Security Roles Explorer

Security Roles Explorer is a Power Platform ToolBox (PPTB) tool that helps you review and manage Dataverse security roles, table privileges, and user-role assignments.

## Install

1. Open Power Platform ToolBox.
2. Go to the Tool Gallery.
3. Search for "Security Roles Explorer".
4. Install the tool.

## Connect

1. Open the tool.
2. Select a Dataverse connection in PPTB if prompted.
3. The tool will load roles, tables, and privileges automatically.

## Edit Security Roles

Use this tab to view or adjust table privileges.

1. Choose a filter mode:
   - By role: show privileges for a single role.
   - By entity: compare multiple roles for a single table.
2. Use the filters or sorting to find the rows you need.
3. Change privilege levels in the grid.
4. Click Apply changes to save, or Undo changes to discard.

Tips:
- Use the Rights filter to show only tables with or without rights.
- In entity mode, use the role filter to include or exclude roles.

## Assign Security Roles

Use this tab to add or remove roles for users.

1. Choose the view:
   - Role -> Users: see who has a role.
   - User -> Roles: see roles for a user.
2. Select users or roles in the list.
3. Click Add or Remove.

## Notes

- Append and Append To are related. You typically need both sides for lookups to work.
- Changes are applied using Dataverse security APIs and may require appropriate permissions.

## Troubleshooting

- If the tool shows "Not connected", select a connection in PPTB and reopen the tool.
- If privileges fail to load, verify the account has security role admin permissions.
- If changes do not show immediately, reload the tool.

## Support

If you have issues or suggestions, open a GitHub issue in this repository.
