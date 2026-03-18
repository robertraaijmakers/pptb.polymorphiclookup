# Polymorphic Lookup
Polymorphic Lookup is a Power Platform ToolBox (PPTB) tool for creating and managing Dataverse polymorphic lookup columns (lookup fields that can reference multiple tables).

More detailed documentation is available at:
[https://robertraaijmakers.github.io/pptb.polymorphiclookup/](https://robertraaijmakers.github.io/pptb.polymorphiclookup/)

## What you can do
- Create a new polymorphic lookup on a Dataverse table
- Add or remove target tables on existing polymorphic lookups
- Update lookup metadata (display name, description, required level)
- Delete a full polymorphic lookup attribute
- Publish customizations directly from the tool

## Quick start
1. Open the tool in PPTB and connect to your Dataverse environment.
2. Select an unmanaged solution.
3. Select a table.
4. Choose either:
	- **Create new lookup**, or
	- an existing polymorphic lookup to update/delete.
5. Save your changes and let the tool publish customizations.

## Notes
- This tool works on metadata. Appropriate Dataverse customization permissions are required.
- Deleting a lookup removes the full attribute and its data references. Use with care.

## License
MIT