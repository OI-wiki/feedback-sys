import {
  Button,
  FormControl,
  FormControlLabel,
  FormGroup,
  Grid,
  makeStyles,
  Radio,
  RadioGroup,
  Switch,
} from '@material-ui/core';
import React from 'react';
import colors, { LabeledPaletteColor } from '../styles/colors';
import { Settings, useSetting } from '../lib/useSetting';
import StyledLayout from '../components/StyledLayout';

const useStyles = makeStyles((theme) => ({
  root: (props: LabeledPaletteColor | Record<string, never>) => ({
    background: props?.main,
    color: props ? props.contrastText : theme.palette.background.default,
    margin: '1em 1.2em 1em 0',
    padding: 0,
    width: '8em',
    height: '8em',
    border: '.1em solid',
    borderColor: theme.palette.divider,
    '&:hover': {
      background: props?.dark,
    },
  }),
  label: {
    lineHeight: '1.2em',
    textAlign: 'left',
    justifyContent: 'left',
    position: 'absolute',
    bottom: '.4em',
    left: '.3em',
    width: 'calc(100% - .6em)',
  },
}));

interface ColorButtonProps {
  data: LabeledPaletteColor
  onClick?: (props: LabeledPaletteColor) => void
}

const ColorButton: React.FC<ColorButtonProps> = (props) => {
  const { data, onClick } = props;
  const classes = useStyles(data.main === 'auto' ? {} : data);
  return (
    <Grid item>
      <Button
        classes={classes}
        onClick={() => onClick?.(data)}
      >
        {props.data.desc}
      </Button>
    </Grid>
  );
};

type SettingsPageProps = {
  location: Location
}
const SettingsPage: React.FC<SettingsPageProps> = (props: SettingsPageProps) => {
  const { location } = props;
  const [settings, updateSetting] = useSetting();

  const onNavColorBtnClick = (c: LabeledPaletteColor): void => {
    updateSetting({
      theme: {
        primary: c.main === 'auto' ? null : c,
      },
    });
  };

  const onSecondaryColorBtnClick = (c: LabeledPaletteColor): void => {
    if (c.main === 'auto') throw new Error('invalid color');
    updateSetting({
      theme: {
        secondary: c.id,
      },
    });
  };

  return (
    <StyledLayout
      location={location}
      noMeta={true}
      noEdit={true}
      noToc={true}
      title="设置"
    >
      <Grid container direction="column" spacing={2}>
        <Grid item>
          <FormControl>
            暗色模式
            <RadioGroup
              name="theme-mode"
              value={settings.darkMode.type}
              onChange={(e) => {
                updateSetting({
                  darkMode: {
                    type: (e.target.value as Settings['darkMode']['type']),
                  },
                });
              }}
            >
              <FormControlLabel value="user-preference" control={<Radio/>} label="跟随系统"/>
              <FormControlLabel value="always-on" control={<Radio/>} label="总是打开"/>
              <FormControlLabel value="always-off" control={<Radio/>} label="总是关闭"/>
            </RadioGroup>
          </FormControl>
        </Grid>
        <Grid item>
          <FormControl>
            动画
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch checked={settings.animation.smoothScroll}
                          name="animation-smooth-scroll"
                          onChange={(e) => {
                            updateSetting({
                              animation: {
                                smoothScroll: e.target.checked,
                              },
                            });
                          }
                          }
                  />
                }
                label="使用平滑滚动"
              />
            </FormGroup>
          </FormControl>
        </Grid>
        <Grid item>
          <FormControl>
            等宽字体
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch checked={settings.theme.fallbackMonoFont}
                          name="monofont"
                          onChange={(e) => {
                            updateSetting({
                              theme: {
                                fallbackMonoFont: e.target.checked,
                              },
                            });
                          }
                          }
                  />
                }
                label="使用浏览器默认字体"
              />
            </FormGroup>
          </FormControl>
        </Grid>
        <Grid item>
          导航栏颜色
          <Grid container>
            {colors.map(c => (<ColorButton data={c} key={c.main} onClick={onNavColorBtnClick}/>))}
          </Grid>
        </Grid>
        <Grid item>
          强调色
          <Grid container>
            {colors.map(c => c.id !== '0' && (<ColorButton data={c} key={c.main} onClick={onSecondaryColorBtnClick}/>))}
          </Grid>
        </Grid>
      </Grid>
    </StyledLayout>
  );
};

export default SettingsPage;
