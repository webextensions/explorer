import * as React from 'react';
import PropTypes from 'prop-types';

import Button from '@mui/material/Button/index.js';
import ButtonGroup from '@mui/material/ButtonGroup/index.js';

import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown.js';

import ClickAwayListener from '@mui/material/ClickAwayListener/index.js';
import Grow from '@mui/material/Grow/index.js';
import Paper from '@mui/material/Paper/index.js';
import Popper from '@mui/material/Popper/index.js';
import MenuItem from '@mui/material/MenuItem/index.js';
import MenuList from '@mui/material/MenuList/index.js';

const SplitButton = function ({ defaultSelectedIndex = 0, options }) {
    const [selectedIndex, setSelectedIndex] = React.useState(defaultSelectedIndex);

    const [open, setOpen] = React.useState(false);
    const anchorRef = React.useRef(null);

    const handleMenuItemClick = (event, index) => {
        setSelectedIndex(index);
        setOpen(false);
    };

    const handleToggle = () => {
        setOpen((prevOpen) => !prevOpen);
    };

    const handleClose = (event) => {
        if (anchorRef.current && anchorRef.current.contains(event.target)) {
            return;
        }

        setOpen(false);
    };

    const selectedOption = options[selectedIndex];

    return (
        <React.Fragment>
            <ButtonGroup
                variant="contained"
                ref={anchorRef}
            >
                <Button
                    onClick={
                        selectedOption.onClick &&
                        (async () => {
                            await selectedOption.onClick();
                        })
                    }
                    href={selectedOption.href}
                    style={{
                        // These styles are useful for "href" based buttons
                        borderTopRightRadius: 0,
                        borderBottomRightRadius: 0,
                        borderRight: '1px solid #1565c0'
                    }}
                >
                    {selectedOption.value}
                </Button>
                <Button
                    size="small"
                    onClick={handleToggle}
                    style={{
                        // These styles are useful for "href" based buttons
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0
                    }}
                >
                    {/* https://github.com/evanw/esbuild/issues/2581#issuecomment-1262991374 */}
                    <ArrowDropDownIcon.default />
                </Button>
            </ButtonGroup>
            <Popper
                sx={{
                    zIndex: 1
                }}
                open={open}
                anchorEl={anchorRef.current}
                transition
                disablePortal
            >
                {({ TransitionProps, placement }) => (
                    <Grow
                        {...TransitionProps}
                        style={{
                            transformOrigin:
                                placement === 'bottom' ? 'center top' : 'center bottom'
                        }}
                    >
                        <Paper>
                            <ClickAwayListener onClickAway={handleClose}>
                                <MenuList id="split-button-menu" autoFocusItem>
                                    {options.map((option, index) => {
                                        return (
                                            <MenuItem
                                                key={option.value}
                                                selected={index === selectedIndex}
                                                onClick={(event) => handleMenuItemClick(event, index)}
                                            >
                                                {option.value}
                                            </MenuItem>
                                        );
                                    })}
                                </MenuList>
                            </ClickAwayListener>
                        </Paper>
                    </Grow>
                )}
            </Popper>
        </React.Fragment>
    );
};
SplitButton.propTypes = {
    defaultSelectedIndex: PropTypes.number,
    options: PropTypes.array.isRequired
};

export { SplitButton };
