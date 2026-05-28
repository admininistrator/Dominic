import yaml from 'js-yaml';

export async function loadAndApplyDesign(urlOrContent, isFileUrl = true) {
  try {
    let content = urlOrContent;
    if (isFileUrl) {
      const response = await fetch(urlOrContent);
      content = await response.text();
    }
    
    const match = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
    if (!match) {
      throw new Error("Invalid DESIGN.md format: Missing YAML frontmatter");
    }

    const yamlContent = match[1];
    const designConfig = yaml.load(yamlContent);

    if (designConfig && designConfig.colors) {
      applyColorsToRoot(designConfig.colors);
    }
    
    return designConfig;
  } catch (error) {
    console.error("Error loading design:", error);
    throw error;
  }
}

export function applyColorsToRoot(colors) {
  const root = document.documentElement;
  Object.keys(colors).forEach((key) => {
    root.style.setProperty(`--${key}`, colors[key]);
  });
}
