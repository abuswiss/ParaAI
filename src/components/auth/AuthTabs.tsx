import React from 'react';
import { 
    Tabs, 
    TabsContent, 
    TabsList, 
    TabsTrigger 
} from "@/components/ui/Tabs"; // Import shadcn Tabs components

interface AuthTabsProps {
  children: React.ReactNode[]; // Expecting an array of two children (SignIn, SignUp forms)
  tabNames: [string, string]; // Expecting exactly two tab names
  defaultTab?: string; // Default value can be one of the tab names (values)
}

const AuthTabs: React.FC<AuthTabsProps> = ({ 
  children, 
  tabNames, 
  defaultTab // Use optional defaultTab prop
}) => {

  // Ensure children and tabNames have the expected length
  if (!Array.isArray(children) || children.length !== 2 || !Array.isArray(tabNames) || tabNames.length !== 2) {
    console.error("AuthTabs requires exactly two children and two tab names.");
    return null; // Or render an error state
  }

  // Use tab names as values for TabsTrigger and TabsContent
  const tab1Value = tabNames[0].toLowerCase().replace(" ", "-");
  const tab2Value = tabNames[1].toLowerCase().replace(" ", "-");

  return (
    <Tabs defaultValue={defaultTab || tab1Value} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value={tab1Value}>{tabNames[0]}</TabsTrigger>
        <TabsTrigger value={tab2Value}>{tabNames[1]}</TabsTrigger>
      </TabsList>
      <TabsContent value={tab1Value} className="p-6 pt-4">
        {children[0]}
      </TabsContent>
      <TabsContent value={tab2Value} className="p-6 pt-4">
        {children[1]}
      </TabsContent>
    </Tabs>
  );
};

export default AuthTabs;