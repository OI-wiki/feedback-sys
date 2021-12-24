import { makeStyles } from '@material-ui/core/styles';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import React from 'react';

const useStyles = makeStyles((theme) => ({
  tab: {
    paddingLeft: theme.spacing(2.5),
    paddingRight: theme.spacing(2.5),
    minWidth: '0',
    '&:hover': {
      color: theme.palette.tab.colorOnHover,
      opacity: '1',
    },
  },
}));

const useIndicatorStyles = makeStyles(() => ({
  indicator: {
    height: '3px',
  },
}));

interface NavTabsProps {
  tabID: number;
  pathList: Array<string | (Array<string | Array<string> | Array<Array<string>>>)>;
}

const NavTabs: React.FC<NavTabsProps> = (props) => {
  const classes = useStyles();
  const indicatorClasses = useIndicatorStyles();
  const { tabID, pathList } = props;
  const newTabs = [];

  for (const curTab of pathList.values()) {
    const curTitle = Object.keys(curTab)[0];
    const values = Object.values(curTab)[0];
    const curLocation = (typeof values === 'string')
      /*
        - 测试: /test/
      */
      ? values
      /*
        - 测试:
          - 测试: /test/
      */
      : Object.values(values[0])[0];
    newTabs.push({ title: curTitle, link: curLocation });
  }
  const [value, setValue] = React.useState(tabID);

  return (
    <Tabs value={value}
          classes={indicatorClasses}
          onChange={(_, newValue) => {
            setValue(newValue);
          }}>
      {newTabs.map(({ title, link }) => (
        <Tab
          disableRipple={true}
          key={title}
          label={title}
          component="a"
          className={classes.tab}
          href={link || '.'}
        />
      ))}
    </Tabs>
  );
};

export default React.memo(NavTabs, (prev, next) => prev.tabID === next.tabID);
