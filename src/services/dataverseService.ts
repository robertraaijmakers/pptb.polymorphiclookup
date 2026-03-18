export const dataverseAPI = (window as any).dataverseAPI;

let cachedLanguageCode: number | null = null;

export type SolutionSummary = {
  id: string;
  uniqueName: string;
  friendlyName: string;
  publisherId: string | null;
};

export type TableSummary = {
  logicalName: string;
  schemaName: string;
  displayName: string;
  metadataId: string;
  entitySetName?: string;
};

export type PolymorphicLookupSummary = {
  logicalName: string;
  schemaName: string;
  displayName: string;
  targets: string[];
  relationshipIds?: Map<string, string>; // Map of target entity to relationship ID
  description?: string;
  requiredLevel?: string;
  metadataId?: string;
};

type LabelLike = {
  LocalizedLabels?: Array<{ Label?: string | null }>;
  UserLocalizedLabel?: { Label?: string | null } | null;
} | null;

type LocalizedLabelPayload = {
  "@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel";
  Label: string;
  LanguageCode: number;
};

type LabelPayload = {
  "@odata.type": "Microsoft.Dynamics.CRM.Label";
  LocalizedLabels: LocalizedLabelPayload[];
  UserLocalizedLabel: LocalizedLabelPayload;
};

function resolveLabel(label: LabelLike): string {
  return (
    label?.UserLocalizedLabel?.Label ??
    label?.LocalizedLabels?.[0]?.Label ??
    ""
  );
}

function buildLocalizedLabelPayload(
  label: string,
  languageCode: number,
): LocalizedLabelPayload {
  return {
    "@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel",
    Label: label,
    LanguageCode: languageCode,
  };
}

function buildLabelPayload(label: string, languageCode: number): LabelPayload {
  return {
    "@odata.type": "Microsoft.Dynamics.CRM.Label",
    LocalizedLabels: [buildLocalizedLabelPayload(label, languageCode)],
    UserLocalizedLabel: buildLocalizedLabelPayload(label, languageCode),
  };
}

async function getLookupAttributeLabels(
  entityLogicalName: string,
  lookupLogicalName: string,
): Promise<{ displayName: string; description: string }> {
  const response = await dataverseAPI.getEntityRelatedMetadata(
    entityLogicalName,
    "Attributes",
    ["LogicalName", "DisplayName", "Description"],
  );
  const attribute = (response?.value ?? []).find(
    (item: any) => item.LogicalName === lookupLogicalName,
  );

  if (!attribute) {
    throw new Error(
      `Could not find lookup metadata for ${entityLogicalName}.${lookupLogicalName}`,
    );
  }

  const displayName = resolveLabel(attribute.DisplayName) || lookupLogicalName;
  const description = resolveLabel(attribute.Description) || displayName;

  return { displayName, description };
}

export async function getDefaultLanguageCode(): Promise<number> {
  // Return cached value if available
  if (cachedLanguageCode !== null) {
    return cachedLanguageCode;
  }

  try {
    // Query the organization's language code (default is usually 1033 for US English)
    // The languagecode field on the Organization table represents the base language
    const response = await dataverseAPI.queryData("organizations?$select=languagecode");
    const languageId = response?.value?.[0]?.languagecode ?? 1033;
    cachedLanguageCode = languageId;
    console.log("Retrieved default language code:", languageId);
    return languageId;
  } catch (error) {
    console.warn("Failed to retrieve default language code, using fallback 1033:", error);
    cachedLanguageCode = 1033;
    return 1033;
  }
}

export async function getUnmanagedSolutions(): Promise<SolutionSummary[]> {
  const response = await dataverseAPI.getSolutions([
    "solutionid",
    "uniquename",
    "friendlyname",
    "ismanaged",
    "_publisherid_value",
  ]);
  const values = response?.value ?? [];
  return values
    .filter((solution: any) => !solution.ismanaged)
    .map((solution: any) => ({
      id: solution.solutionid,
      uniqueName: solution.uniquename,
      friendlyName: solution.friendlyname ?? solution.uniquename,
      publisherId: solution._publisherid_value ?? solution.publisherid ?? null,
    }))
    .sort((a: SolutionSummary, b: SolutionSummary) =>
      a.friendlyName.localeCompare(b.friendlyName, undefined, {
        sensitivity: "base",
      }),
    );
}

export async function getPublisherPrefix(publisherId: string | null) {
  if (!publisherId) {
    return null;
  }
  const publisher = await dataverseAPI.retrieve("publisher", publisherId, [
    "customizationprefix",
    "friendlyname",
    "uniquename",
  ]);
  return {
    prefix: publisher?.customizationprefix ?? null,
    name: publisher?.friendlyname ?? publisher?.uniquename ?? null,
  };
}

// NOTE TO SELF: IF WE WANT TO SUPPORT DELETE OF POLY THEN WE NEED TO DO THE FOLLOWING:
// - DELETE TO URL: EntityDefinitions(LogicalName='new_accountsupportinitiative')/Attributes(1216e3c3-e6ad-459c-9207-573e6049a92d)

export async function getAllTables(): Promise<TableSummary[]> {
  const response = await dataverseAPI.getAllEntitiesMetadata([
    "LogicalName",
    "SchemaName",
    "DisplayName",
    "MetadataId",
    "EntitySetName",
  ]);
  return (response?.value ?? [])
    .map((entity: any) => ({
      logicalName: entity.LogicalName,
      schemaName: entity.SchemaName ?? entity.LogicalName,
      displayName: resolveLabel(entity.DisplayName) || entity.LogicalName,
      metadataId: entity.MetadataId,
      entitySetName: entity.EntitySetName ?? undefined,
    }))
    .sort((a: TableSummary, b: TableSummary) =>
      a.displayName.localeCompare(b.displayName, undefined, {
        sensitivity: "base",
      }),
    );
}

export async function getSolutionTableIds(solutionId: string): Promise<Set<string>> {
  const response = await dataverseAPI.queryData(
    `solutioncomponents?$select=objectid,componenttype&$filter=_solutionid_value eq ${solutionId} and componenttype eq 1`,
  );
  const ids = new Set<string>();
  for (const component of response?.value ?? []) {
    if (component.objectid) {
      ids.add(component.objectid);
    }
  }
  return ids;
}

export function filterTablesByMetadataId(
  allTables: TableSummary[],
  tableIds: Set<string>,
): TableSummary[] {
  return allTables.filter((table) => tableIds.has(table.metadataId));
}

export async function getPolymorphicLookups(
  entityLogicalName: string,
): Promise<PolymorphicLookupSummary[]> {
  const response = await dataverseAPI.getEntityRelatedMetadata(
    entityLogicalName,
    "Attributes",
  );
  const lookups = (response?.value ?? [])
    .filter((attribute: any) => {
      if (attribute["@odata.type"] !== "#Microsoft.Dynamics.CRM.LookupAttributeMetadata") {
        return false;
      }
      if (attribute.AttributeType !== "Lookup") {
        return false;
      }
      if (attribute.AttributeTypeName?.Value !== "LookupType") {
        return false;
      }
      return Array.isArray(attribute.Targets) && attribute.Targets.length >= 2;
    })
    .map((attribute: any) => ({
      logicalName: attribute.LogicalName,
      schemaName: attribute.SchemaName ?? attribute.LogicalName,
      displayName: resolveLabel(attribute.DisplayName) || attribute.LogicalName,
      targets: Array.isArray(attribute.Targets) ? attribute.Targets : [],
      relationshipIds: new Map<string, string>(), // Will be populated below
      description: resolveLabel(attribute.Description) || "",
      requiredLevel: attribute.RequiredLevel?.Value ?? "None",
      metadataId: attribute.MetadataId,
    }))
    .sort((a: PolymorphicLookupSummary, b: PolymorphicLookupSummary) =>
      a.displayName.localeCompare(b.displayName, undefined, {
        sensitivity: "base",
      }),
    );

  // Fetch relationship IDs for each lookup
  for (const lookup of lookups) {
    const relationshipIds = await getPolymorphicLookupRelationshipIds(
      entityLogicalName,
      lookup.logicalName,
    );
    lookup.relationshipIds = relationshipIds;
  }

  return lookups;
}

export async function getPolymorphicLookupRelationshipIds(
  entityLogicalName: string,
  lookupLogicalName: string,
): Promise<Map<string, string>> {
  try {
    // Query relationships with Lookup metadata included
    const response = await dataverseAPI.queryData(
      `RelationshipDefinitions/Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata?$select=SchemaName,ReferencedAttribute,ReferencedEntity,ReferencingEntity,ReferencingAttribute,MetadataId&$filter=ReferencingAttribute eq '${lookupLogicalName}'`,
    );

    const relationshipMap = new Map<string, string>();
    const relationships = response?.value ?? [];

    console.log("Fetching relationships for:", { entityLogicalName, lookupLogicalName, totalRelationships: relationships.length });

    for (const rel of relationships) {
      console.log("Found matching relationship:", { schemaName: rel.SchemaName, referencedEntity: rel.ReferencedEntity, metadataId: rel.MetadataId });
      relationshipMap.set(rel.ReferencedEntity, rel.MetadataId);
    }

    console.log("Relationship IDs found:", relationshipMap);
    return relationshipMap;
  } catch (error) {
    console.warn("Failed to fetch relationship IDs:", error);
    return new Map<string, string>();
  }
}

export async function addPolymorphicLookupRelationship(
  entityLogicalName: string,
  lookupLogicalName: string,
  lookupSchemaName: string,
  targetEntity: string,
  relationshipSchemaName: string,
  publisherPrefix: string = "new_",
): Promise<{ RelationshipId?: string }> {
  const languageCode = await getDefaultLanguageCode();
  const lookupLabels = await getLookupAttributeLabels(
    entityLogicalName,
    lookupLogicalName,
  );
  const payload: any = {
    SchemaName: relationshipSchemaName,
    "@odata.type": "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata",
    ReferencedEntity: targetEntity,
    ReferencingEntity: entityLogicalName,
    Lookup: {
      AttributeType: "Lookup",
      AttributeTypeName: { Value: "LookupType" },
      Description: buildLabelPayload(lookupLabels.description, languageCode),
      DisplayName: buildLabelPayload(lookupLabels.displayName, languageCode),
      SchemaName: lookupSchemaName,
      "@odata.type": "Microsoft.Dynamics.CRM.LookupAttributeMetadata",
    },
  };

  console.log("Adding relationship to polymorphic lookup:", {
    entityLogicalName,
    lookupLogicalName,
    targetEntity,
    relationshipSchemaName,
  });

  const response = await dataverseAPI.create("RelationshipDefinition", payload);

  return {
    RelationshipId: response?.id,
  };
}

export async function removePolymorphicLookupRelationship(
  relationshipId: string,
): Promise<{ success: boolean }> {
  console.log("Removing relationship from polymorphic lookup:", relationshipId);

  await dataverseAPI.delete(`RelationshipDefinition`, relationshipId);

  return { success: true };
}

export async function removePolymorphicLookup(
  entityLogicalName: string,
  attributeIdentifier: string,
): Promise<{ success: boolean }> {
  console.log("Removing polymorphic lookup attribute:", {
    entityLogicalName,
    attributeIdentifier,
  });

  await dataverseAPI.deleteAttribute(entityLogicalName, attributeIdentifier);

  return { success: true };
}

export async function createPolymorphicLookup(
  entityLogicalName: string,
  displayName: string,
  schemaName: string,
  targets: string[],
  solutionUniqueName: string,
  description?: string,
  requiredLevel?: string,
  publisherPrefix: string = "new_",
) {
  const languageCode = await getDefaultLanguageCode();

  // Build lookup metadata object with proper structure
  const lookupMetadata: any = {
    "@odata.type": "Microsoft.Dynamics.CRM.ComplexLookupAttributeMetadata",
    SchemaName: schemaName,
    DisplayName: {
      LocalizedLabels: [{ Label: displayName || schemaName, LanguageCode: languageCode }],
    },
    RequiredLevel: { Value: requiredLevel ?? "None" },
    Targets: targets,
  };

  if (description) {
    lookupMetadata.Description = {
      LocalizedLabels: [{ Label: description, LanguageCode: languageCode }],
    };
  }

  // Build OneToManyRelationships array from target tables
  const relationships = targets.map((targetEntity, index) => ({
    SchemaName: `${publisherPrefix}${schemaName.toLowerCase().replace(publisherPrefix,"")}_${targetEntity}`,
    ReferencedEntity: targetEntity,
    ReferencingEntity: entityLogicalName,
  }));

  const parameters: any = {
    Lookup: lookupMetadata,
    OneToManyRelationships: relationships,
  };

  if (solutionUniqueName) {
    parameters.SolutionUniqueName = solutionUniqueName;
  }

  console.log("Creating polymorphic lookup with unbound action:", {
    entityLogicalName,
    schemaName,
    displayName,
    targets,
    solutionUniqueName,
    parameters,
  });

  const response = await dataverseAPI.execute({
    operationName: "CreatePolymorphicLookupAttribute",
    operationType: "action",
    parameters,
  });

  const attributeId = response?.AttributeId;
  if (!attributeId) {
    throw new Error(
      "CreatePolymorphicLookupAttribute did not return AttributeId. Response: " +
      JSON.stringify(response),
    );
  }

  console.log("Created polymorphic lookup AttributeId:", attributeId);

  return { AttributeId: attributeId };
}

export async function updatePolymorphicLookupTargets(
  entityLogicalName: string,
  lookupLogicalName: string,
  lookupSchemaName: string,
  currentTargets: string[],
  selectedTargets: string[],
  publisherPrefix: string = "new_",
): Promise<{ added: number; removed: number }> {
  const currentSet = new Set(currentTargets);
  const selectedSet = new Set(selectedTargets);

  const toAdd = selectedTargets.filter((t) => !currentSet.has(t));
  const toRemove = currentTargets.filter((t) => !selectedSet.has(t));

  let addedCount = 0;
  let removedCount = 0;

  console.log("Updating polymorphic lookup targets:", {
    entityLogicalName,
    lookupLogicalName,
    toAdd,
    toRemove,
  });

  // Get relationship IDs for removal
  const relationshipIds = await getPolymorphicLookupRelationshipIds(
    entityLogicalName,
    lookupLogicalName,
  );

  // Remove relationships
  for (const target of toRemove) {
    const relationshipId = relationshipIds.get(target);
    if (relationshipId) {
      await removePolymorphicLookupRelationship(relationshipId);
      removedCount++;
    }
  }

  // Add relationships
  for (const target of toAdd) {
    const relationshipSchemaName = `${publisherPrefix}${lookupSchemaName.toLowerCase()}_${target.toLowerCase()}`;
    await addPolymorphicLookupRelationship(
      entityLogicalName,
      lookupLogicalName,
      lookupSchemaName,
      target,
      relationshipSchemaName,
      publisherPrefix,
    );
    addedCount++;
  }

  return { added: addedCount, removed: removedCount };
}

export async function updatePolymorphicLookupMetadata(
  entityLogicalName: string,
  lookupLogicalName: string,
  displayName?: string,
  description?: string,
  requiredLevel?: string,
  schemaName?: string,
  metadataId?: string,
): Promise<{ success: boolean }> {
  // Validate required parameters
  if (!entityLogicalName || typeof entityLogicalName !== "string") {
    throw new Error(`Invalid entityLogicalName: ${entityLogicalName}`);
  }
  if (!lookupLogicalName || typeof lookupLogicalName !== "string") {
    throw new Error(`Invalid lookupLogicalName: ${lookupLogicalName}`);
  }

  const languageCode = await getDefaultLanguageCode();
  const updatePayload: any = {};

  // Note: Do NOT include LogicalName - it's immutable in Dataverse
  // Only include MetadataId if provided (some metadata update APIs require it)
  if (metadataId) {
    updatePayload.MetadataId = metadataId;
  }

  if (displayName && displayName.trim()) {
    updatePayload.DisplayName = {
      LocalizedLabels: [{ Label: displayName.trim(), LanguageCode: languageCode }],
    };
  }

  if (description !== undefined && description !== "") {
    updatePayload.Description = {
      LocalizedLabels: [{ Label: description.trim(), LanguageCode: languageCode }],
    };
  }

  if (requiredLevel && requiredLevel !== "None") {
    updatePayload.RequiredLevel = { Value: requiredLevel };
  }

  if (Object.keys(updatePayload).length === 0) {
    // No actual changes
    return { success: true };
  }

  console.log("Updating polymorphic lookup metadata:", {
    entityLogicalName,
    lookupLogicalName,
    updatePayload,
  });
  
  console.log("updateAttribute call params:", {
    param1_entityLogicalName: entityLogicalName,
    param1_type: typeof entityLogicalName,
    param2_lookupLogicalName: lookupLogicalName,
    param2_type: typeof lookupLogicalName,
    param3_updatePayload: JSON.stringify(updatePayload),
    param3_keys: Object.keys(updatePayload),
  });

  try {
    await dataverseAPI.updateAttribute(entityLogicalName, lookupLogicalName, updatePayload);
  } catch (error) {
    console.error("updateAttribute failed:", {
      entityLogicalName,
      lookupLogicalName,
      error,
    });
    throw error;
  }

  return { success: true };
}

export async function publishCustomizations(entityLogicalName?: string) {
  return dataverseAPI.publishCustomizations(entityLogicalName);
}
