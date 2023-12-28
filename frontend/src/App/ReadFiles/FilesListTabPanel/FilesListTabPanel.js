import React from 'react';

import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';

const FilesListTabPanel = function () {
    return (
        <Tabs defaultActiveKey="1">
            <TabList>
                <Tab>Dir 1</Tab>
                <Tab>Dir 2</Tab>
                <Tab>Dir 3</Tab>
            </TabList>

            <TabPanel tab="Dir 1" key="1">
                Dir 1
            </TabPanel>
            <TabPanel tab="Dir 2" key="2">
                Dir 2
            </TabPanel>
            <TabPanel tab="Dir 3" key="3">
                Dir 3
            </TabPanel>
        </Tabs>
    );
};

export { FilesListTabPanel };
