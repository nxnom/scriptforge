import { useParams } from "react-router-dom";
import { PlaceholderPage } from "./PlaceholderPage";

export function ToolPage() {
  const { toolId } = useParams();
  return <PlaceholderPage title="Image Resizer" description={`The ${toolId} workflow is the next milestone.`} />;
}
